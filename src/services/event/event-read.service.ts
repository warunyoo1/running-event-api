import type { Types } from "mongoose";
import type { FilterQuery } from "mongoose";
import { PUBLIC_EVENT_STATUSES } from "../../config/constants";
import { EventModel, Order, Race } from "../../models";
import type { EventDoc } from "../../models/event.model";
import type { RaceLean } from "../../models/race.model";
import type { PageMeta } from "../../types/api";
import { groupBy } from "../../utils/collections";
import { escapeRegex, pageMeta, skipOf } from "../../utils/pagination";
import type {
  AdminEventsQuery,
  PublicEventsQuery,
} from "../../validators/event.validator";
import {
  toAdminEventView,
  toPublicEventView,
  type AdminEventView,
  type PublicEventView,
} from "../../views/event.view";
import { QUOTA_HOLDING } from "../order/order-state";
import { eventNotFound } from "../service-errors";

/** Active races per event id, in display order. */
async function racesByEvent(
  eventIds: Types.ObjectId[],
): Promise<Map<string, RaceLean[]>> {
  const races: RaceLean[] = await Race.find({
    eventId: { $in: eventIds },
    active: true,
  })
    .sort({ sortOrder: 1 })
    .lean();
  return groupBy(races, (r) => String(r.eventId));
}

export async function listPublic(
  f: PublicEventsQuery,
): Promise<PublicEventView[]> {
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
  return events.map((e) =>
    toPublicEventView(e, races.get(String(e._id)) ?? []),
  );
}

export async function getPublicBySlug(
  slug: string,
): Promise<PublicEventView> {
  const e = await EventModel.findOne({
    slug: slug.toLowerCase(),
    archived: false,
    status: { $in: [...PUBLIC_EVENT_STATUSES] },
  }).lean();
  if (!e) throw eventNotFound();
  const races = await racesByEvent([e._id]);
  return toPublicEventView(e, races.get(String(e._id)) ?? []);
}

/** Quota-holding orders per event id. */
async function activeOrderCounts(
  eventIds: Types.ObjectId[],
): Promise<Map<string, number>> {
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

export async function listAdmin(
  q: AdminEventsQuery,
): Promise<{ data: AdminEventView[]; meta: PageMeta }> {
  const filter: FilterQuery<EventDoc> = { archived: q.archived };
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
  const data = events.map((e) =>
    toAdminEventView(
      e,
      races.get(String(e._id)) ?? [],
      counts.get(String(e._id)) ?? 0,
    ),
  );
  return { data, meta: pageMeta(q, total) };
}

export async function getAdmin(id: string): Promise<AdminEventView> {
  // Admin only: archived events are returned too (their view shows `archived: true`).
  const e = await EventModel.findOne({ _id: id }).lean();
  if (!e) throw eventNotFound();
  const [races, counts] = await Promise.all([
    racesByEvent([e._id]),
    activeOrderCounts([e._id]),
  ]);
  return toAdminEventView(
    e,
    races.get(String(e._id)) ?? [],
    counts.get(String(e._id)) ?? 0,
  );
}
