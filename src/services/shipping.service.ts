import { Types, type FilterQuery, type PipelineStage } from "mongoose";
import { EXPORT_LIMIT } from "../config/constants";
import { Order, Participant } from "../models";
import type { OrderDoc, OrderLean } from "../models/order.model";
import type { PageMeta } from "../types/api";
import { groupBy } from "../utils/collections";
import { escapeRegex, pageMeta, skipOf } from "../utils/pagination";
import type {
  ExportShippingQuery,
  ShippingQuery,
} from "../validators/admin.validator";
import {
  toShippingRowView,
  type ShippingRowView,
} from "../views/shipping.view";

function baseFilterOf(q: ExportShippingQuery): FilterQuery<OrderDoc> {
  const f: FilterQuery<OrderDoc> = { status: "paid" };
  // Aggregation does not cast strings, so the id is converted here for both uses.
  if (q.eventId) f.eventId = new Types.ObjectId(q.eventId);
  if (q.method) f.delivery = q.method;
  return f;
}

/**
 * Order ids whose participants match the text (full name or BIB), restricted to
 * orders that satisfy the base filter, so non-paid orders can never match.
 * Uses $lookup with localField/foreignField plus pipeline (MongoDB 5.0+).
 */
export function shippingSearchPipeline(
  text: string,
  base: FilterQuery<OrderDoc>,
): PipelineStage[] {
  const re = new RegExp(escapeRegex(text), "i");
  return [
    {
      $match: {
        $or: [
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ["$firstName", " ", "$lastName"] },
                regex: escapeRegex(text),
                options: "i",
              },
            },
          },
          { bibNo: re },
        ],
      },
    },
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        pipeline: [{ $match: base }, { $project: { _id: 1 } }],
        as: "o",
      },
    },
    { $match: { "o.0": { $exists: true } } },
    { $group: { _id: "$orderId" } },
  ];
}

async function buildFilter(q: ExportShippingQuery): Promise<FilterQuery<OrderDoc>> {
  const base = baseFilterOf(q);
  if (!q.q) return base;
  const re = new RegExp(escapeRegex(q.q), "i");
  const rows = await Participant.aggregate<{ _id: Types.ObjectId }>(
    shippingSearchPipeline(q.q, base),
  );
  return {
    ...base,
    $or: [
      { orderNo: re },
      { contactName: re },
      { contactPhone: re },
      { trackingNo: re },
      { _id: { $in: rows.map((r) => r._id) } },
    ],
  };
}
async function build(orders: OrderLean[]): Promise<ShippingRowView[]> {
  const participants = await Participant.find({
    orderId: { $in: orders.map((o) => o._id) },
  })
    .sort({ _id: 1 })
    .lean();
  const byOrder = groupBy(participants, (p) => String(p.orderId));
  return orders.map((o) =>
    toShippingRowView(o, byOrder.get(String(o._id)) ?? []),
  );
}
export async function list(
  q: ShippingQuery,
): Promise<{ data: ShippingRowView[]; meta: PageMeta }> {
  const filter = await buildFilter(q);
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ paidAt: 1, _id: 1 })
      .skip(skipOf(q))
      .limit(q.pageSize)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { data: await build(orders), meta: pageMeta(q, total) };
}

export async function listForExport(
  q: ExportShippingQuery,
): Promise<ShippingRowView[]> {
  return build(
    await Order.find(await buildFilter(q))
      .sort({ paidAt: 1, _id: 1 })
      .limit(EXPORT_LIMIT)
      .lean(),
  );
}
