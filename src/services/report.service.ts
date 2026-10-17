import { Types } from "mongoose";
import { shirtSizes } from "../config/constants";
import { EventModel, Order, Participant } from "../models";
import { bangkokRange } from "../utils/date-range";
import type {
  ShirtSizesQuery,
  SummaryQuery,
} from "../validators/admin.validator";
import { QUOTA_HOLDING } from "./order-state";

export async function summary(q: SummaryQuery) {
  const orderMatch: Record<string, unknown> = {};
  if (q.eventId) orderMatch.eventId = new Types.ObjectId(q.eventId);
  const range = bangkokRange(q.from, q.to);
  if (range) orderMatch.createdAt = range;

  const totalsRows = await Order.aggregate<{
    _id: string;
    n: number;
    amount: number;
  }>([
    { $match: { ...orderMatch, status: { $in: [...QUOTA_HOLDING] } } },
    { $group: { _id: "$status", n: { $sum: 1 }, amount: { $sum: "$amount" } } },
  ]);
  const paid = totalsRows.find((r) => r._id === "paid");
  const rows = await Participant.aggregate<{
    _id: { eventId: Types.ObjectId; race: string };
    participants: number;
    paidParticipants: number;
    revenue: number;
  }>([
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "o",
      },
    },
    { $unwind: "$o" },
    {
      $match: {
        ...Object.fromEntries(
          Object.entries(orderMatch).map(([k, v]) => [
            k === "createdAt" ? "o.createdAt" : `o.${k}`,
            v,
          ]),
        ),
        "o.status": { $in: [...QUOTA_HOLDING] },
      },
    },
    {
      $group: {
        _id: { eventId: "$eventId", race: "$raceName" },
        participants: { $sum: 1 },
        paidParticipants: {
          $sum: { $cond: [{ $eq: ["$o.status", "paid"] }, 1, 0] },
        },
        revenue: {
          $sum: { $cond: [{ $eq: ["$o.status", "paid"] }, "$price", 0] },
        },
      },
    },
    { $sort: { "_id.eventId": 1, "_id.race": 1 } },
  ]);
  const events = await EventModel.find({
    _id: { $in: rows.map((r) => r._id.eventId) },
  })
    .select("name")
    .lean();
  const evName = new Map(events.map((e) => [String(e._id), e.name]));
  return {
    totals: {
      orders: totalsRows.reduce((a, r) => a + r.n, 0),
      paidOrders: paid?.n ?? 0,
      paidRevenue: paid?.amount ?? 0,
    },
    rows: rows.map((r) => ({
      eventId: String(r._id.eventId),
      eventName: evName.get(String(r._id.eventId)) ?? "",
      race: r._id.race,
      participants: r.participants,
      paidParticipants: r.paidParticipants,
      revenue: r.revenue,
    })),
  };
}

export async function shirtSizeReport(q: ShirtSizesQuery) {
  const rows = await Participant.aggregate<{
    _id: { race: string; size: string };
    n: number;
  }>([
    ...(q.eventId
      ? [{ $match: { eventId: new Types.ObjectId(q.eventId) } }]
      : []),
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "o",
      },
    },
    { $unwind: "$o" },
    { $match: { "o.status": q.status } },
    { $group: { _id: { race: "$raceName", size: "$size" }, n: { $sum: 1 } } },
  ]);
  const sizes = shirtSizes.map((size) => ({
    size,
    count: rows.filter((r) => r._id.size === size).reduce((a, r) => a + r.n, 0),
  }));
  const races = [...new Set(rows.map((r) => r._id.race))].sort();
  return {
    status: q.status,
    sizes,
    total: sizes.reduce((a, s) => a + s.count, 0),
    byRace: races.map((race) => ({
      race,
      sizes: Object.fromEntries(
        shirtSizes.map((size) => [
          size,
          rows.find((r) => r._id.race === race && r._id.size === size)?.n ?? 0,
        ]),
      ),
    })),
  };
}
