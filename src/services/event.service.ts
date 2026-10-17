import type { FilterQuery } from "mongoose";
import { EventModel, Order, Race } from "../models";
import type { EventDoc } from "../models/event.model";
import { ApiError } from "../utils/api-error";
import { escapeRegex, pageMeta, skipOf } from "../utils/pagination";
import { withTransaction } from "../utils/transaction";
import { bangkokToday } from "../validators/common.validator";
import type { EventBody } from "../validators/event.validator";
import { audit } from "./audit.service";
import { QUOTA_HOLDING } from "./order-state";

type RaceLean = {
  _id: unknown;
  name: string;
  price: number;
  quota: number;
  reserved: number;
  start?: string | null;
  sortOrder: number;
};

const raceView = (r: RaceLean) => ({
  id: String(r._id),
  name: r.name,
  price: r.price,
  quota: r.quota,
  start: r.start ?? null,
  remaining: Math.max(0, r.quota - r.reserved),
});

async function racesByEvent(eventIds: unknown[]) {
  const races = await Race.find({ eventId: { $in: eventIds }, active: true })
    .sort({ sortOrder: 1 })
    .lean();
  const map = new Map<string, RaceLean[]>();
  for (const r of races) {
    const key = String(r.eventId);
    map.set(key, [...(map.get(key) ?? []), r as unknown as RaceLean]);
  }
  return map;
}

const eventView = (e: { _id: unknown } & Partial<EventDoc>) => {
  const { _id, ...rest } = e as Record<string, unknown>;
  delete rest.__v;
  return { id: String(_id), ...rest };
};

const PUBLIC_STATUSES = ["open", "closed", "upcoming"];

export async function listPublic(f: {
  q?: string;
  province?: string;
  month?: string;
  distance?: string;
  category?: string;
  status?: string;
}) {
  const filter: FilterQuery<EventDoc> = {
    archived: false,
    status: { $in: PUBLIC_STATUSES },
  };
  if (f.status) filter.status = f.status;
  if (f.province) filter.province = f.province;
  if (f.category) filter.category = f.category;
  if (f.month) filter.date = { $regex: `^${escapeRegex(f.month)}` };
  if (f.q) {
    const re = new RegExp(escapeRegex(f.q), "i");
    filter.$or = [{ name: re }, { venue: re }, { province: re }];
  }
  if (f.distance) {
    const ids = await Race.distinct("eventId", {
      name: f.distance,
      active: true,
    });
    filter._id = { $in: ids };
  }
  const events = await EventModel.find(filter).sort({ date: 1 }).lean();
  const races = await racesByEvent(events.map((e) => e._id));
  return events.map((e) => ({
    ...eventView(e),
    races: (races.get(String(e._id)) ?? []).map(raceView),
  }));
}

export async function getPublicBySlug(slug: string) {
  const e = await EventModel.findOne({
    slug: slug.toLowerCase(),
    archived: false,
    status: { $in: PUBLIC_STATUSES },
  }).lean();
  if (!e) throw ApiError.notFound("ไม่พบงานวิ่ง", "EVENT_NOT_FOUND");
  const races = await racesByEvent([e._id]);
  return {
    ...eventView(e),
    races: (races.get(String(e._id)) ?? []).map(raceView),
  };
}

async function activeOrderCounts(eventIds: unknown[]) {
  const rows = await Order.aggregate<{ _id: unknown; n: number }>([
    {
      $match: {
        eventId: { $in: eventIds },
        status: { $in: [...QUOTA_HOLDING] },
      },
    },
    { $group: { _id: "$eventId", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export async function listAdmin(q: {
  page: number;
  pageSize: number;
  q?: string;
  status?: string;
}) {
  const filter: FilterQuery<EventDoc> = { archived: false };
  if (q.status) filter.status = q.status;
  if (q.q) filter.name = new RegExp(escapeRegex(q.q), "i");
  const [events, total] = await Promise.all([
    EventModel.find(filter)
      .sort({ date: -1 })
      .skip(skipOf(q))
      .limit(q.pageSize)
      .lean(),
    EventModel.countDocuments(filter),
  ]);
  const ids = events.map((e) => e._id);
  const [races, counts] = await Promise.all([
    racesByEvent(ids),
    activeOrderCounts(ids),
  ]);
  const data = events.map((e) => ({
    ...eventView(e),
    orderCount: counts.get(String(e._id)) ?? 0,
    races: (races.get(String(e._id)) ?? []).map(raceView),
  }));
  return { data, meta: pageMeta(q, total) };
}

export async function getAdmin(id: string) {
  const e = await EventModel.findOne({ _id: id, archived: false }).lean();
  if (!e) throw ApiError.notFound("ไม่พบงานวิ่ง", "EVENT_NOT_FOUND");
  const [races, counts] = await Promise.all([
    racesByEvent([e._id]),
    activeOrderCounts([e._id]),
  ]);
  return {
    ...eventView(e),
    orderCount: counts.get(String(e._id)) ?? 0,
    races: (races.get(String(e._id)) ?? []).map(raceView),
  };
}

function eventFields(body: EventBody) {
  const { races: _races, ...fields } = body;
  return fields;
}

export async function create(actorId: string, body: EventBody) {
  if (await EventModel.exists({ slug: body.slug }))
    throw ApiError.conflict("SLUG_TAKEN", "slug นี้ถูกใช้แล้ว");
  const id = await withTransaction(async (session) => {
    const [event] = await EventModel.create([eventFields(body)], { session });
    await Race.create(
      body.races.map((r, i) => ({
        eventId: event._id,
        name: r.name,
        price: r.price,
        quota: r.quota,
        start: r.start,
        sortOrder: i,
      })),
      { session, ordered: true },
    );
    return String(event._id);
  });
  await audit(actorId, "event.create", "Event", id, { slug: body.slug });
  return getAdmin(id);
}

export async function update(actorId: string, id: string, body: EventBody) {
  const event = await EventModel.findOne({ _id: id, archived: false });
  if (!event) throw ApiError.notFound("ไม่พบงานวิ่ง", "EVENT_NOT_FOUND");
  if (
    body.slug !== event.slug &&
    (await EventModel.exists({ slug: body.slug, _id: { $ne: id } }))
  ) {
    throw ApiError.conflict("SLUG_TAKEN", "slug นี้ถูกใช้แล้ว");
  }

  const existing = await Race.find({ eventId: id });
  const hasOrders = !!(await Order.exists({
    eventId: id,
    status: { $in: [...QUOTA_HOLDING] },
  }));

  // Match incoming races to existing ones: by id when given, otherwise by name (also revives inactive races).
  const byId = new Map(existing.map((r) => [String(r._id), r]));
  const byName = new Map(existing.map((r) => [r.name, r]));
  const matched = body.races.map((r) =>
    r.id ? byId.get(r.id) : byName.get(r.name),
  );
  if (body.races.some((r, i) => r.id && !matched[i]))
    throw ApiError.validation({ races: "ไม่พบระยะที่ระบุ" });
  const keptIds = new Set(matched.filter(Boolean).map((r) => String(r!._id)));

  if (hasOrders) {
    const locked = (msg: string) => ApiError.conflict("EVENT_HAS_ORDERS", msg);
    body.races.forEach((r, i) => {
      const m = matched[i];
      if (m && m.active && (m.price !== r.price || m.quota !== r.quota))
        throw locked("มีออเดอร์แล้ว ไม่สามารถแก้ราคาหรือโควตาของระยะได้");
      if (m && m.name !== r.name)
        throw locked("มีออเดอร์แล้ว ไม่สามารถเปลี่ยนชื่อระยะได้");
    });
    if (existing.some((r) => r.active && !keptIds.has(String(r._id))))
      throw locked("มีออเดอร์แล้ว ไม่สามารถลบระยะได้");
  }
  for (const [i, r] of body.races.entries()) {
    const m = matched[i];
    if (m && r.quota < m.reserved)
      throw ApiError.validation({
        [`races.${i}.quota`]: "โควตาต้องไม่น้อยกว่าจำนวนที่จองแล้ว",
      });
  }

  await withTransaction(async (session) => {
    await EventModel.updateOne(
      { _id: id },
      { $set: eventFields(body) },
      { session },
    );
    // Deactivate removed races (only reachable when there are no active orders).
    await Race.updateMany(
      { eventId: id, _id: { $nin: [...keptIds] } },
      { $set: { active: false } },
      { session },
    );
    for (const [i, r] of body.races.entries()) {
      const m = matched[i];
      const set = {
        name: r.name,
        price: r.price,
        quota: r.quota,
        start: r.start,
        sortOrder: i,
        active: true,
      };
      if (m) await Race.updateOne({ _id: m._id }, { $set: set }, { session });
      else await Race.create([{ eventId: id, ...set }], { session });
    }
  });
  await audit(actorId, "event.update", "Event", id, { slug: body.slug });
  return getAdmin(id);
}
