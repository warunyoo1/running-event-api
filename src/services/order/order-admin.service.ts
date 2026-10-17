import type { FilterQuery, Types } from "mongoose";
import { EventModel, Order, Participant, Payment } from "../../models";
import type { OrderDoc } from "../../models/order.model";
import { ApiError } from "../../utils/api-error";
import { bangkokRange } from "../../utils/date-range";
import { withId } from "../../utils/lean";
import { escapeRegex, pageMeta, skipOf } from "../../utils/pagination";
import { withTransaction } from "../../utils/transaction";
import type {
  AdminOrdersQuery,
  ExportOrdersQuery,
} from "../../validators/admin.validator";
import { audit } from "../audit.service";
import { statusesBefore } from "../order-state";
import { maskedParticipant } from "../participant.service";
import { transitionAndRelease } from "./order-quota";

const orderNotFound = () =>
  ApiError.notFound("ไม่พบออเดอร์", "ORDER_NOT_FOUND");

/** Loads an order with only the `select`ed fields, or throws ORDER_NOT_FOUND. */
export async function findOrderOr404(id: string, select: string) {
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

type LeanOrder = {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  raceCounts?: unknown;
  quotaReleased?: unknown;
};

/** Admin view of lean orders: adds event name/slug and participant count, hides internal quota bookkeeping. */
export async function decorateOrders<T extends LeanOrder>(orders: T[]) {
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
    const event = evMap.get(String(o.eventId));
    return {
      ...withId(o, ["raceCounts", "quotaReleased"]),
      eventName: event?.name ?? "",
      eventSlug: event?.slug ?? "",
      participantCount: nMap.get(String(o._id)) ?? 0,
    };
  });
}

export async function getAdmin(id: string) {
  const order = await Order.findById(id).lean();
  if (!order) throw orderNotFound();
  const [[decorated], participants, payments] = await Promise.all([
    decorateOrders([order]),
    Participant.find({ orderId: id }).sort({ _id: 1 }).lean(),
    Payment.find({ orderId: id }).sort({ createdAt: -1 }).lean(),
  ]);
  return {
    ...decorated,
    participants: participants.map((p) => maskedParticipant(p)),
    payments: payments.map((p) => withId(p, ["slipPath"])),
  };
}

export async function cancel(actorId: string, id: string, reason?: string) {
  await findOrderOr404(id, "status");
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
