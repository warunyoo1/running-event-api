import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { env } from "../config/env";
import { EventModel, Order, Participant, Payment, Race, User, syncAllIndexes } from "../models";
import { QUOTA_HOLDING } from "../services/order-state";
import { adminOnlyEvents, buildMockOrders, mockUsers, publicEvents, type SeedEvent } from "./seed-data";

export type SeedConfig = {
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  mockUsers: boolean;
  mockUserPassword?: string;
  production: boolean;
  allowProduction: boolean;
};

// 1x1 transparent PNG, used as a placeholder slip for seeded orders.
const TINY_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

export function loadSeedConfig(): SeedConfig {
  return {
    adminEmail: (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase(),
    adminPassword: process.env.SEED_ADMIN_PASSWORD ?? "",
    adminName: process.env.SEED_ADMIN_NAME?.trim() || "Super Admin",
    mockUsers: process.env.SEED_MOCK_USERS === "true",
    mockUserPassword: process.env.SEED_MOCK_USER_PASSWORD,
    production: env.isProd,
    allowProduction: process.env.SEED_ALLOW_PRODUCTION === "true",
  };
}

async function ensureUser(name: string, email: string, password: string, role: "super_admin" | "reviewer" | "viewer") {
  const existing = await User.findOne({ email });
  if (existing) return { user: existing, created: false };
  const user = await User.create({ name, email, role, active: true, passwordHash: await bcrypt.hash(password, env.BCRYPT_COST) });
  return { user, created: true };
}

async function seedEvent(e: SeedEvent) {
  const { races, id: _id, ...fields } = e;
  await EventModel.updateOne({ slug: e.slug }, { $setOnInsert: fields }, { upsert: true });
  const event = (await EventModel.findOne({ slug: e.slug }))!;
  for (const [i, r] of races.entries()) {
    await Race.updateOne({ eventId: event._id, name: r.name }, { $setOnInsert: { price: r.price, quota: r.quota, start: r.start, sortOrder: i, active: true, reserved: 0 } }, { upsert: true });
  }
  return event;
}

async function seedOrders(reviewerId?: string) {
  const slipDir = path.resolve(env.UPLOAD_DIR, "slips");
  await mkdir(slipDir, { recursive: true });
  let created = 0;
  for (const o of buildMockOrders()) {
    if (await Order.exists({ orderNo: o.orderNo })) continue;
    const event = (await EventModel.findOne({ slug: o.eventSlug }))!;
    const race = (await Race.findOne({ eventId: event._id, name: o.raceName }))!;
    const subtotal = race.price * o.participants.length;
    const shippingFee = o.delivery === "shipping" ? env.SHIPPING_FEE : 0;
    const reviewed = o.status === "paid" || o.status === "rejected";
    const order = await Order.create({
      orderNo: o.orderNo, eventId: event._id, contactName: o.contactName, contactPhone: o.phone, delivery: o.delivery,
      address: o.delivery === "shipping" ? { street: "99 ถนนตัวอย่าง", subdistrict: "สวนหลวง", district: "สวนหลวง", province: "กรุงเทพมหานคร", postalCode: "10250" } : undefined,
      subtotal, shippingFee, amount: subtotal + shippingFee, status: o.status,
      expiresAt: o.status === "pending" ? new Date(Date.now() + env.ORDER_EXPIRE_HOURS * 3600_000) : new Date(o.createdAt.getTime() + env.ORDER_EXPIRE_HOURS * 3600_000),
      raceCounts: [{ raceId: race._id, count: o.participants.length }],
      rejectionReason: o.rejectionReason,
      ...(o.status === "paid" ? { transactionRef: o.transactionRef, paidAt: o.createdAt } : {}),
      ...(reviewed ? { reviewedAt: o.createdAt, reviewedBy: reviewerId } : {}),
      ...(["slip_uploaded", "paid", "rejected"].includes(o.status) ? { slipUploadedAt: o.createdAt } : {}),
      createdAt: o.createdAt,
    });
    await Participant.insertMany(o.participants.map((p) => ({
      orderId: order._id, eventId: event._id, raceId: race._id, raceName: race.name, price: race.price,
      firstName: p.firstName, lastName: p.lastName, gender: "ไม่ระบุ", birthDate: "1990-01-01", nationality: "ไทย",
      declineIdentity: true, phone: o.phone, province: "กรุงเทพมหานคร", applicantType: "บุคคลทั่วไป", size: p.size, bibNo: p.bibNo,
    })));
    if (["slip_uploaded", "paid", "rejected"].includes(o.status)) {
      const file = `seed-${o.orderNo}.png`;
      await writeFile(path.join(slipDir, file), TINY_PNG);
      await Payment.create({
        orderId: order._id, slipPath: file, slipMime: "image/png", amount: subtotal + shippingFee,
        status: o.status === "paid" ? "approved" : o.status === "rejected" ? "rejected" : "submitted",
        transactionRef: o.status === "paid" ? o.transactionRef : undefined, rejectReason: o.rejectionReason,
        reviewedBy: reviewed ? reviewerId : undefined, reviewedAt: reviewed ? o.createdAt : undefined,
      });
    }
    created++;
  }
  return created;
}

/** reserved = participants in orders that hold quota. Authoritative, so safe to re-run. */
export async function recomputeReserved() {
  const rows = await Order.aggregate<{ _id: unknown; n: number }>([
    { $match: { status: { $in: [...QUOTA_HOLDING] } } },
    { $unwind: "$raceCounts" },
    { $group: { _id: "$raceCounts.raceId", n: { $sum: "$raceCounts.count" } } },
  ]);
  const map = new Map(rows.map((r) => [String(r._id), r.n]));
  for (const race of await Race.find()) {
    const n = map.get(String(race._id)) ?? 0;
    if (race.reserved !== n) await Race.updateOne({ _id: race._id }, { $set: { reserved: n } });
  }
}

export async function runSeed(cfg: SeedConfig) {
  if (!cfg.adminEmail || !cfg.adminPassword) throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required");
  if (cfg.adminPassword.length < 10) throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters");

  const log: string[] = [];
  const { user: admin, created } = await ensureUser(cfg.adminName, cfg.adminEmail, cfg.adminPassword, "super_admin");
  log.push(created ? `super_admin created: ${cfg.adminEmail}` : `super_admin exists: ${cfg.adminEmail} (password unchanged)`);

  if (cfg.production && !cfg.allowProduction) {
    log.push("NODE_ENV=production: skipped events/orders/mock users (set SEED_ALLOW_PRODUCTION=true to override)");
    return log;
  }

  for (const e of [...publicEvents, ...adminOnlyEvents]) await seedEvent(e);
  log.push(`events ensured: ${publicEvents.length} public + ${adminOnlyEvents.length} draft`);

  let reviewerId = String(admin._id);
  if (cfg.mockUsers) {
    if (!cfg.mockUserPassword || cfg.mockUserPassword.length < 10) {
      log.push("WARNING: SEED_MOCK_USERS=true but SEED_MOCK_USER_PASSWORD missing/short (<10): mock users skipped");
    } else {
      for (const u of mockUsers) {
        const r = await ensureUser(u.name, u.email, cfg.mockUserPassword, u.role);
        if (u.role === "reviewer") reviewerId = String(r.user._id);
      }
      log.push(`mock users ensured: ${mockUsers.length}`);
    }
  }

  log.push(`mock orders created: ${await seedOrders(reviewerId)}`);
  await recomputeReserved();
  return log;
}

async function main() {
  await connectDatabase();
  try {
    await syncAllIndexes();
    for (const line of await runSeed(loadSeedConfig())) console.log(line);
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Seed failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

