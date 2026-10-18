import type { FilterQuery, HydratedDocument, Types } from "mongoose";
import { EventModel, Order, Participant, Payment } from "../../models";
import type { OrderDoc, OrderLean } from "../../models/order.model";
import type { PageMeta } from "../../types/api";
import { ApiError } from "../../utils/api-error";
import { bangkokRange } from "../../utils/date-range";
import { escapeRegex, pageMeta, skipOf } from "../../utils/pagination";
import type {
  AddressBody,
  AdminOrdersQuery,
  ExportOrdersQuery,
} from "../../validators/admin.validator";
import {
  toAdminOrderDetailView,
  toAdminOrderView,
  type AdminOrderFullDetailView,
  type AdminOrderView,
} from "../../views/order.view";
import { audit } from "../audit.service";
import { loadDetailExtras } from "./order-detail.service";
import { trimAddress } from "./order-address";
import { transitionAndRelease } from "./order-quota";
import { ADDRESS_EDITABLE, canEditAddress, statusesBefore } from "./order-state";

const orderNotFound = () =>
  ApiError.notFound("ไม่พบออเดอร์", "ORDER_NOT_FOUND");

const addressLocked = () =>
  ApiError.conflict(
    "INVALID_STATE",
    "แก้ไขที่อยู่ได้เฉพาะออเดอร์จัดส่งที่ยังไม่ได้ใส่เลขพัสดุและยังไม่ถูกยกเลิก/หมดอายุ",
  );

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

export async function getAdmin(id: string): Promise<AdminOrderFullDetailView> {
  const order = await Order.findById(id).lean();
  if (!order) throw orderNotFound();
  const [[decorated], participants, payments] = await Promise.all([
    decorateOrders([order]),
    Participant.find({ orderId: id }).sort({ _id: 1 }).lean(),
    Payment.find({ orderId: id }).sort({ createdAt: -1 }).lean(),
  ]);
  const extras = await loadDetailExtras(order, payments);
  return toAdminOrderDetailView(decorated, participants, payments, extras);
}

export async function cancel(
  actorId: string,
  id: string,
  reason?: string,
): Promise<AdminOrderFullDetailView> {
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
): Promise<AdminOrderFullDetailView> {
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
  await audit(actorId, "order.tracking", "Order", id, {
    provider,
    trackingNo: no,
  });
  return getAdmin(id);
}
export async function updateAddress(
  actorId: string,
  id: string,
  input: AddressBody,
): Promise<AdminOrderFullDetailView> {
  const order = await findOrderOr404(id, "status delivery trackingNo address");
  if (!canEditAddress(order)) throw addressLocked();
  const before = order.toObject().address ?? null;
  const after = trimAddress(input);
  // Guarded write: a concurrent tracking number, cancel or expiry makes this match nothing.
  const res = await Order.updateOne(
    {
      _id: id,
      delivery: "shipping",
      status: { $in: [...ADDRESS_EDITABLE] },
      trackingNo: null,
    },
    { $set: { address: after } },
  );
  if (res.matchedCount === 0) throw addressLocked();
  await audit(actorId, "order.address.update", "Order", id, { before, after });
  return getAdmin(id);
}