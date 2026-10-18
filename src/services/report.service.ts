import { Types } from "mongoose";
import { EventModel, Order, Participant } from "../models";
import { bangkokRange } from "../utils/date-range";
import type {
  ShirtSizesQuery,
  SummaryQuery,
} from "../validators/admin.validator";
import {
  toReportSummaryView,
  toShirtSizeReportView,
  type ReportSummaryView,
  type ShirtSizeReportView,
  type ShirtSizeRow,
  type SummaryRaceRow,
  type SummaryTotalsRow,
} from "../views/report.view";
import { QUOTA_HOLDING } from "./order/order-state";

export async function summary(q: SummaryQuery): Promise<ReportSummaryView> {
  const orderMatch: Record<string, unknown> = {};
  if (q.eventId) orderMatch.eventId = new Types.ObjectId(q.eventId);
  const range = bangkokRange(q.from, q.to);
  if (range) orderMatch.createdAt = range;

  const totalsRows = await Order.aggregate<SummaryTotalsRow>([
    { $match: { ...orderMatch, status: { $in: [...QUOTA_HOLDING] } } },
    { $group: { _id: "$status", n: { $sum: 1 }, amount: { $sum: "$amount" } } },
  ]);
  const rows = await Participant.aggregate<SummaryRaceRow>([
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
  return toReportSummaryView(totalsRows, rows, evName);
}

export async function shirtSizeReport(
  q: ShirtSizesQuery,
): Promise<ShirtSizeReportView> {
  const rows = await Participant.aggregate<ShirtSizeRow>([
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
  return toShirtSizeReportView(q.status, rows);
}
