import type { ClientSession, FilterQuery, Types } from "mongoose";
import { env } from "../config/env";
import { EventModel, Order, Participant, Payment, Race } from "../models";
import type { OrderDoc } from "../models/order.model";
import { ApiError, type FieldErrors } from "../utils/api-error";
import { encryptText, maskLast4 } from "../utils/crypto";
import { bangkokRange } from "../utils/date-range";
import { generateOrderNo } from "../utils/order-no";
import { escapeRegex, pageMeta, skipOf } from "../utils/pagination";
import { withTransaction } from "../utils/transaction";
import type { AdminOrdersQuery } from "../validators/admin.validator";
import { bangkokToday } from "../validators/common.validator";
import {
  cleanPhone,
  validateOrderInput,
  type CreateOrderInput,
} from "../validators/order.validator";
import { audit } from "./audit.service";
import { statusesBefore } from "./order-state";

const maskedParticipant = (p: Record<string, any>) => {
  const { idNumberEnc: _enc, idLast4, _id, __v, ...rest } = p;
  return {
    id: String(_id),
    ...rest,
    idNumber: p.declineIdentity ? "" : maskLast4(idLast4),
  };
};
export { maskedParticipant };

/** Create an order: validate, atomically reserve quota in a transaction, compute totals server-side. */
export async function createOrder(slug: string, input: CreateOrderInput) {
  const event = await EventModel.findOne({
    slug: slug.toLowerCase(),
    archived: false,
    status: { $in: ["open", "closed", "upcoming"] },
  });
  if (!event) throw ApiError.notFound("ไม่พบงานวิ่ง", "EVENT_NOT_FOUND");
  if (
    event.status !== "open" ||
    (event.registrationEnds && event.registrationEnds < bangkokToday())
  ) {
    throw ApiError.conflict("REGISTRATION_CLOSED", "งานนี้ปิดรับสมัครแล้ว");
  }
  const races = await Race.find({ eventId: event._id, active: true });
  const errors = validateOrderInput(
    input,
    races.map((r) => r.name),
  );
  if (Object.keys(errors).length) throw ApiError.validation(errors);

  const raceByName = new Map(races.map((r) => [r.name, r]));
  const counts = new Map<string, number>();
  let subtotal = 0;
  for (const p of input.participants) {
    const race = raceByName.get(p.race)!;
    counts.set(String(race._id), (counts.get(String(race._id)) ?? 0) + 1);
    subtotal += race.price;
  }
  const shippingFee =
    input.delivery.method === "shipping" ? env.SHIPPING_FEE : 0;
  const amount = subtotal + shippingFee;
  const expiresAt = new Date(Date.now() + env.ORDER_EXPIRE_HOURS * 3600_000);
  const d = input.delivery;

  for (let attempt = 0; ; attempt++) {
    const orderNo = generateOrderNo();
    try {
      await withTransaction(async (session) => {
        // Reserve in sorted race-id order to keep lock ordering consistent between concurrent orders.
        const full: FieldErrors = {};
        for (const [raceId, n] of [...counts.entries()].sort(([a], [b]) =>
          a.localeCompare(b),
        )) {
          const reserved = await Race.findOneAndUpdate(
            {
              _id: raceId,
              active: true,
              $expr: { $lte: [{ $add: ["$reserved", n] }, "$quota"] },
            },
            { $inc: { reserved: n } },
            { session, new: true },
          );
          if (!reserved)
            full[races.find((r) => String(r._id) === raceId)!.name] =
              "โควตาเต็มหรือเหลือไม่พอ";
        }
        if (Object.keys(full).length)
          throw ApiError.conflict(
            "QUOTA_FULL",
            "โควตาของระยะที่เลือกเต็มหรือเหลือไม่พอ",
            full,
          );

        const [order] = await Order.create(
          [
            {
              orderNo,
              eventId: event._id,
              contactName: d.contact.trim(),
              contactPhone: cleanPhone(d.phone),
              contactEmail: d.email.trim() || undefined,
              delivery: d.method,
              address:
                d.method === "shipping"
                  ? {
                      street: d.street.trim(),
                      subdistrict: d.subdistrict.trim(),
                      district: d.district.trim(),
                      province: d.province,
                      postalCode: d.postalCode.trim(),
                    }
                  : undefined,
              subtotal,
              shippingFee,
              amount,
              status: "pending",
              expiresAt,
              raceCounts: [...counts.entries()].map(([raceId, count]) => ({
                raceId,
                count,
              })),
            },
          ],
          { session },
        );
        await Participant.insertMany(
          input.participants.map((p) => {
            const race = raceByName.get(p.race)!;
            const identity = p.identity.trim();
            const store = !p.declineIdentity && identity !== "";
            return {
              orderId: order._id,
              eventId: event._id,
              raceId: race._id,
              raceName: race.name,
              price: race.price,
              firstName: p.firstName.trim(),
              lastName: p.lastName.trim(),
              gender: p.gender,
              birthDate: `${p.birthYear}-${p.birthMonth.padStart(2, "0")}-${p.birthDay.padStart(2, "0")}`,
              nationality: p.nationality,
              idNumberEnc: store ? encryptText(identity) : undefined,
              idLast4: store ? identity.slice(-4) : undefined,
              declineIdentity: p.declineIdentity,
              email: p.email.trim() || undefined,
              phone: cleanPhone(p.phone),
              medical: p.medical.trim() || undefined,
              blood: p.blood.trim() || undefined,
              emergencyName: p.emergencyName.trim() || undefined,
              emergencyRelation: p.emergencyRelation.trim() || undefined,
              emergencyPhone: p.emergencyPhone.trim()
                ? cleanPhone(p.emergencyPhone)
                : undefined,
              province: p.province,
              team: p.team.trim() || undefined,
              applicantType: p.applicantType,
              size: p.size,
            };
          }),
          { session },
        );
      });
      return {
        orderNo,
        status: "pending" as const,
        amount: { subtotal, shipping: shippingFee, total: amount },
        expiresAt,
      };
    } catch (err) {
      // Order number collision: try a new number (transaction already rolled back).
      if (
        (err as { code?: number }).code === 11000 &&
        String((err as Error).message).includes("orderNo_unique") &&
        attempt < 5
      )
        continue;
      throw err;
    }
  }
}

const GENERIC_NOT_FOUND = () =>
  ApiError.notFound("ไม่พบออเดอร์หรือข้อมูลไม่ตรงกัน", "ORDER_NOT_FOUND");

/** Loads an order only when orderNo and the last 4 phone digits match (no oracle between the two). */
export async function loadByOrderNoAndPhone(
  orderNo: string,
  phoneLast4: string,
) {
  const order = await Order.findOne({ orderNo: orderNo.toUpperCase() });
  if (!order || !order.contactPhone.endsWith(phoneLast4))
    throw GENERIC_NOT_FOUND();
  return order;
}

export async function findPublic(orderNo: string, phoneLast4: string) {
  const order = await loadByOrderNoAndPhone(orderNo, phoneLast4);
  const [event, participants] = await Promise.all([
    EventModel.findById(order.eventId).lean(),
    Participant.find({ orderId: order._id })
      .select("raceName size")
      .sort({ _id: 1 })
      .lean(),
  ]);
  const expired =
    order.status === "pending" &&
    !!order.expiresAt &&
    order.expiresAt.getTime() < Date.now();
  return {
    orderNo: order.orderNo,
    event: event
      ? {
          slug: event.slug,
          name: event.name,
          date: event.date,
          venue: event.venue,
        }
      : null,
    races: participants.map((p) => ({ race: p.raceName, size: p.size })),
    amount: {
      subtotal: order.subtotal,
      shipping: order.shippingFee,
      total: order.amount,
    },
    delivery: order.delivery,
    status: order.status,
    createdAt: (order as unknown as { createdAt: Date }).createdAt,
    ...(order.status === "pending" ? { expiresAt: order.expiresAt } : {}),
    ...(order.status === "rejected" && order.rejectionReason
      ? { rejectionReason: order.rejectionReason }
      : {}),
    canUploadSlip:
      ["pending", "slip_uploaded", "rejected"].includes(order.status) &&
      !expired,
  };
}

function adminFilter(q: Partial<AdminOrdersQuery>): FilterQuery<OrderDoc> {
  const filter: FilterQuery<OrderDoc> = {};
  if (q.eventId) filter.eventId = q.eventId;
  if (q.status) filter.status = q.status;
  const range = bangkokRange(q.from, q.to);
  if (range) (filter as Record<string, unknown>).createdAt = range;
  if (q.q) {
    const re = new RegExp(escapeRegex(q.q), "i");
    filter.$or = [{ orderNo: re }, { contactName: re }, { contactPhone: re }];
  }
  return filter;
}

export async function listAdmin(q: AdminOrdersQuery) {
  const filter = adminFilter(q);
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skipOf(q))
      .limit(q.pageSize)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { data: await decorateOrders(orders), meta: pageMeta(q, total) };
}

export async function decorateOrders(orders: Array<Record<string, any>>) {
  const ids = orders.map((o) => o._id);
  const [events, counts] = await Promise.all([
    EventModel.find({ _id: { $in: orders.map((o) => o.eventId) } })
      .select("name slug")
      .lean(),
    Participant.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { orderId: { $in: ids } } },
      { $group: { _id: "$orderId", n: { $sum: 1 } } },
    ]),
  ]);
  const evMap = new Map(events.map((e) => [String(e._id), e]));
  const nMap = new Map(counts.map((c) => [String(c._id), c.n]));
  return orders.map((o) => {
    const { _id, __v, raceCounts: _rc, ...rest } = o;
    return {
      id: String(_id),
      ...rest,
      eventName: evMap.get(String(o.eventId))?.name ?? "",
      eventSlug: evMap.get(String(o.eventId))?.slug ?? "",
      participantCount: nMap.get(String(_id)) ?? 0,
    };
  });
}

export async function getAdmin(id: string) {
  const order = await Order.findById(id).lean();
  if (!order) throw ApiError.notFound("ไม่พบออเดอร์", "ORDER_NOT_FOUND");
  const [[decorated], participants, payments] = await Promise.all([
    decorateOrders([order]),
    Participant.find({ orderId: id }).sort({ _id: 1 }).lean(),
    Payment.find({ orderId: id }).sort({ createdAt: -1 }).lean(),
  ]);
  return {
    ...decorated,
    participants: participants.map((p) => maskedParticipant(p)),
    payments: payments.map(({ _id, slipPath: _s, __v, ...p }) => ({
      id: String(_id),
      ...p,
    })),
  };
}

/** Atomic conditional transition + quota release (cancel / expire). Returns false if the state no longer matches. */
export async function transitionAndRelease(
  filter: FilterQuery<OrderDoc>,
  to: "cancelled" | "expired",
  set: Record<string, unknown>,
  session: ClientSession,
): Promise<boolean> {
  const order = await Order.findOneAndUpdate(
    filter,
    { $set: { status: to, ...set } },
    { session, new: false },
  );
  if (!order) return false;
  for (const rc of order.raceCounts) {
    await Race.updateOne(
      { _id: rc.raceId },
      { $inc: { reserved: -(rc.count ?? 0) } },
      { session },
    );
  }
  return true;
}

export async function cancel(actorId: string, id: string, reason?: string) {
  const order = await Order.findById(id).select("status");
  if (!order) throw ApiError.notFound("ไม่พบออเดอร์", "ORDER_NOT_FOUND");
  await withTransaction(async (session) => {
    const done = await transitionAndRelease(
      { _id: id, status: { $in: statusesBefore("cancelled") } },
      "cancelled",
      { cancelReason: reason },
      session,
    );
    if (!done)
      throw ApiError.conflict(
        "INVALID_STATE",
        "ออเดอร์นี้ไม่สามารถยกเลิกได้ในสถานะปัจจุบัน",
      );
  });
  await audit(actorId, "order.cancel", "Order", id, { reason });
  return getAdmin(id);
}

export async function setTracking(
  actorId: string,
  id: string,
  provider: string,
  no: string,
) {
  const order = await Order.findById(id).select("status delivery");
  if (!order) throw ApiError.notFound("ไม่พบออเดอร์", "ORDER_NOT_FOUND");
  if (order.delivery !== "shipping")
    throw ApiError.conflict(
      "INVALID_STATE",
      "ออเดอร์นี้รับที่หน้างาน ไม่มีการจัดส่ง",
    );
  if (order.status !== "paid")
    throw ApiError.conflict(
      "INVALID_STATE",
      "ใส่เลขพัสดุได้เฉพาะออเดอร์ที่ชำระเงินแล้ว",
    );
  await Order.updateOne(
    { _id: id },
    { $set: { trackingProvider: provider, trackingNo: no } },
  );
  await audit(actorId, "order.tracking", "Order", id, { provider });
  return getAdmin(id);
}
