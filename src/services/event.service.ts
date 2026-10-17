import type { ClientSession, FilterQuery, Types } from "mongoose";
import { PUBLIC_EVENT_STATUSES } from "../config/constants";
import { EventModel, Order, Race } from "../models";
import type { EventDoc } from "../models/event.model";
import type { RaceLean } from "../models/race.model";
import { ApiError } from "../utils/api-error";
import { groupBy } from "../utils/collections";
import { withId } from "../utils/lean";
import { escapeRegex, pageMeta, skipOf } from "../utils/pagination";
import { withTransaction } from "../utils/transaction";
import type {
  AdminEventsQuery,
  EventBody,
  PublicEventsQuery,
} from "../validators/event.validator";
import { audit } from "./audit.service";
import { QUOTA_HOLDING } from "./order-state";

const eventNotFound = () =>
  ApiError.notFound("ไม่พบงานวิ่ง", "EVENT_NOT_FOUND");

const raceView = (r: RaceLean) => ({
  id: String(r._id),
  name: r.name,
  price: r.price,
  quota: r.quota,
  start: r.start ?? null,
  remaining: Math.max(0, r.quota - r.reserved),
});

/** Active races per event id, in display order. */
async function racesByEvent(eventIds: Types.ObjectId[]) {
  const races: RaceLean[] = await Race.find({
    eventId: { $in: eventIds },
    active: true,
  })
    .sort({ sortOrder: 1 })
    .lean();
  return groupBy(races, (r) => String(r.eventId));
}

type LeanEvent = { _id: Types.ObjectId };

/** Event fields + its race views (public and admin share this shape). */
const eventWithRaces = <T extends LeanEvent>(
  e: T,
  races: Map<string, RaceLean[]>,
) => ({
  ...withId(e),
  races: (races.get(String(e._id)) ?? []).map(raceView),
});

/** Admin view: event fields + number of quota-holding orders + race views. */
const adminEventView = <T extends LeanEvent>(
  e: T,
  races: Map<string, RaceLean[]>,
  orderCounts: Map<string, number>,
) => ({
  ...withId(e),
  orderCount: orderCounts.get(String(e._id)) ?? 0,
  races: (races.get(String(e._id)) ?? []).map(raceView),
});

export async function listPublic(f: PublicEventsQuery) {
  const filter: FilterQuery<EventDoc> = {
    archived: false,
    status: { $in: [...PUBLIC_EVENT_STATUSES] },
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
  return events.map((e) => eventWithRaces(e, races));
}

export async function getPublicBySlug(slug: string) {
  const e = await EventModel.findOne({
    slug: slug.toLowerCase(),
    archived: false,
    status: { $in: [...PUBLIC_EVENT_STATUSES] },
  }).lean();
  if (!e) throw eventNotFound();
  return eventWithRaces(e, await racesByEvent([e._id]));
}

/** Quota-holding orders per event id. */
async function activeOrderCounts(eventIds: Types.ObjectId[]) {
  const rows = await Order.aggregate<{ _id: Types.ObjectId; n: number }>([
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

export async function listAdmin(q: AdminEventsQuery) {
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
  const data = events.map((e) => adminEventView(e, races, counts));
  return { data, meta: pageMeta(q, total) };
}

export async function getAdmin(id: string) {
  const e = await EventModel.findOne({ _id: id, archived: false }).lean();
  if (!e) throw eventNotFound();
  const [races, counts] = await Promise.all([
    racesByEvent([e._id]),
    activeOrderCounts([e._id]),
  ]);
  return adminEventView(e, races, counts);
}

function eventFields(body: EventBody) {
  const { races: _races, ...fields } = body;
  return fields;
}

const slugTaken = () => ApiError.conflict("SLUG_TAKEN", "slug นี้ถูกใช้แล้ว");

export async function create(actorId: string, body: EventBody) {
  if (await EventModel.exists({ slug: body.slug })) throw slugTaken();
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

const quotaBelowReserved = (i: number) =>
  ApiError.validation({
    [`races.${i}.quota`]: "โควตาต้องไม่น้อยกว่าจำนวนที่จองแล้ว",
  });

/**
 * Applies the race list of an event update inside `session`. The order/quota checks run in the
 * same transaction as the writes, so a concurrent order cannot slip in between check and write
 * (every touched race is written here, so a concurrent reservation hits a write conflict and retries).
 */
async function updateRaces(
  id: string,
  races: EventBody["races"],
  session: ClientSession,
) {
  const existing = await Race.find({ eventId: id }, null, { session });
  const hasOrders = !!(await Order.exists({
    eventId: id,
    status: { $in: [...QUOTA_HOLDING] },
  }).session(session));

  // Match incoming races to existing ones: by id when given, otherwise by name (also revives inactive races).
  const byId = new Map(existing.map((r) => [String(r._id), r]));
  const byName = new Map(existing.map((r) => [r.name, r]));
  const matched = races.map((r) =>
    r.id ? byId.get(r.id) : byName.get(r.name),
  );
  if (races.some((r, i) => r.id && !matched[i]))
    throw ApiError.validation({ races: "ไม่พบระยะที่ระบุ" });
  const keptIds = new Set(matched.filter(Boolean).map((r) => String(r!._id)));

  if (hasOrders) {
    const locked = (msg: string) => ApiError.conflict("EVENT_HAS_ORDERS", msg);
    races.forEach((r, i) => {
      const m = matched[i];
      if (m && m.active && (m.price !== r.price || m.quota !== r.quota))
        throw locked("มีออเดอร์แล้ว ไม่สามารถแก้ราคาหรือโควตาของระยะได้");
      if (m && m.name !== r.name)
        throw locked("มีออเดอร์แล้ว ไม่สามารถเปลี่ยนชื่อระยะได้");
    });
    if (existing.some((r) => r.active && !keptIds.has(String(r._id))))
      throw locked("มีออเดอร์แล้ว ไม่สามารถลบระยะได้");
  }
  races.forEach((r, i) => {
    const m = matched[i];
    if (m && r.quota < m.reserved) throw quotaBelowReserved(i);
  });

  // Deactivate removed races (only reachable when there are no active orders).
  await Race.updateMany(
    { eventId: id, _id: { $nin: [...keptIds] } },
    { $set: { active: false } },
    { session },
  );
  for (const [i, r] of races.entries()) {
    const m = matched[i];
    const set = {
      name: r.name,
      price: r.price,
      quota: r.quota,
      start: r.start,
      sortOrder: i,
      active: true,
    };
    if (!m) {
      await Race.create([{ eventId: id, ...set }], { session });
      continue;
    }
    // The reserved filter keeps quota >= reserved atomic with the write.
    const res = await Race.updateOne(
      { _id: m._id, reserved: { $lte: r.quota } },
      { $set: set },
      { session },
    );
    if (res.matchedCount === 0) throw quotaBelowReserved(i);
  }
}

export async function update(actorId: string, id: string, body: EventBody) {
  const event = await EventModel.findOne({ _id: id, archived: false });
  if (!event) throw eventNotFound();
  if (
    body.slug !== event.slug &&
    (await EventModel.exists({ slug: body.slug, _id: { $ne: id } }))
  ) {
    throw slugTaken();
  }

  await withTransaction(async (session) => {
    await updateRaces(id, body.races, session);
    await EventModel.updateOne(
      { _id: id },
      { $set: eventFields(body) },
      { session },
    );
  });
  await audit(actorId, "event.update", "Event", id, { slug: body.slug });
  return getAdmin(id);
}
