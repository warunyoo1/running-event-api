import type { FilterQuery } from "mongoose";
import { EXPORT_LIMIT } from "../config/constants";
import { Order, Participant } from "../models";
import type { OrderDoc, OrderLean } from "../models/order.model";
import type { PageMeta } from "../types/api";
import { groupBy } from "../utils/collections";
import { pageMeta, skipOf } from "../utils/pagination";
import type {
  ExportShippingQuery,
  ShippingQuery,
} from "../validators/admin.validator";
import {
  toShippingRowView,
  type ShippingRowView,
} from "../views/shipping.view";

function filterOf(q: ExportShippingQuery): FilterQuery<OrderDoc> {
  const f: FilterQuery<OrderDoc> = { status: "paid" };
  if (q.eventId) f.eventId = q.eventId;
  if (q.method) f.delivery = q.method;
  return f;
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
  const filter = filterOf(q);
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
    await Order.find(filterOf(q))
      .sort({ paidAt: 1, _id: 1 })
      .limit(EXPORT_LIMIT)
      .lean(),
  );
}
