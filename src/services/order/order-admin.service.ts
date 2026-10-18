import type { FilterQuery, HydratedDocument, Types } from "mongoose";
import { EventModel, Order, Participant, Payment } from "../../models";
import type { OrderDoc, OrderLean } from "../../models/order.model";
import type { PageMeta } from "../../types/api";
import { ApiError } from "../../utils/api-error";
import { bangkokRange } from "../../utils/date-range";
import { escapeRegex, pageMeta, skipOf } from "../../utils/pagination";
import type {
  AdminOrdersQuery,
  ExportOrdersQuery,
} from "../../validators/admin.validator";
import {
  toAdminOrderDetailView,
  toAdminOrderView,
  type AdminOrderDetailView,
  type AdminOrderView,
} from "../../views/order.view";
import { audit } from "../audit.service";
import { transitionAndRelease } from "./order-quota";
import { statusesBefore } from "./order-state";

const orderNotFound = () =>
  ApiError.notFound("ไม่พบออเดอร์", "ORDER_NOT_FOUND");

/** Loads an order with only the `select`ed fields, or throws ORDER_NOT_FOUND. */
export async function findOrderOr404(
  id: string,
  select: string,
): Promise<HydratedDocument<OrderDoc>> {
  const order = await Order.findById(id).select(select);
  if (!order) throw orderNotFound();
  return order;
}

/** Filter shared by the admin order list and the orders CSV export. */
export function adminFilter(q: ExportOrdersQuery): FilterQuery<OrderDoc> {
  const filter: FilterQuery<OrderDoc> = {};
  if (q.eventId) filter.eventId = q.eventId;
  if (q.status) filter.status = q.status;
  const range = bangkokRange(q.from, q.to);
  if (range) filter.createdAt = range;
  if (q.q) {
    const re = new RegExp(escapeRegex(q.q), "i");
    filter.$or = [{ orderNo: re }, { contactName: re }, { contactPhone: re }];
  }
  return filter;
}

export async function listAdmin(
  q: AdminOrdersQuery,
): Promise<{ data: AdminOrderView[]; meta: PageMeta }> {
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

/** Admin view of lean orders: adds event name/slug and participant count, hides internal quota bookkeeping. */
export async function decorateOrders(
  orders: OrderLean[],
): Promise<AdminOrderView[]> {
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
  return orders.map((o) =>
    toAdminOrderView(
      o,
      evMap.get(String(o.eventId)),
      nMap.get(String(o._id)) ?? 0,
    ),
  );
}

export async function getAdmin(id: string): Promise<AdminOrderDetailView> {
  const order = await Order.findById(id).lean();
  if (!order) throw orderNotFound();
  const [[decorated], participants, payments] = await Promise.all([
    decorateOrders([order]),
    Participant.find({ orderId: id }).sort({ _id: 1 }).lean(),
    Payment.find({ orderId: id }).sort({ createdAt: -1 }).lean(),
  ]);
  return toAdminOrderDetailView(decorated, participants, payments);
}

export async function cancel(
  actorId: string,
  id: string,
  reason?: string,
): Promise<AdminOrderDetailView> {
  await findOrderOr404(id, "status");
  const done = await transitionAndRelease(
    { _id: id, status: { $in: statusesBefore("cancelled") } },
    "cancelled",
    { cancelReason: reason },
  );
  if (!done)
    throw ApiError.conflict(
      "INVALID_STATE",
      "ออเดอร์นี้ไม่สามารถยกเลิกได้ในสถานะปัจจุบัน",
    );
  await audit(actorId, "order.cancel", "Order", id, { reason });
  return getAdmin(id);
}

export async function setTracking(
  actorId: string,
  id: string,
  provider: string,
  no: string,
): Promise<AdminOrderDetailView> {
  const order = await findOrderOr404(id, "status delivery");
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
