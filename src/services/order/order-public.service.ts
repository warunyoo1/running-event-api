import type { OrderStatus } from "../../config/constants";
import { EventModel, Order, Participant } from "../../models";
import { ApiError } from "../../utils/api-error";
import { statusesBefore } from "../order-state";

const GENERIC_NOT_FOUND = () =>
  ApiError.notFound("ไม่พบออเดอร์หรือข้อมูลไม่ตรงกัน", "ORDER_NOT_FOUND");

/** A `pending` order past `expiresAt` that the expiry job has not picked up yet. */
export const isOverduePending = (order: {
  status: OrderStatus;
  expiresAt?: Date | null;
}) =>
  order.status === "pending" &&
  !!order.expiresAt &&
  order.expiresAt.getTime() < Date.now();

/** Loads an order only when orderNo and the last 4 phone digits match (no oracle between the two). */
export async function loadByOrderNoAndPhone(
  orderNo: string,
  phoneLast4: string,
) {
  const order = await Order.findOne({ orderNo: orderNo.toUpperCase() });
  if (!order || !order.contactPhone.endsWith(phoneLast4))
    throw GENERIC_NOT_FOUND();
  return order;
}

export async function findPublic(orderNo: string, phoneLast4: string) {
  const order = await loadByOrderNoAndPhone(orderNo, phoneLast4);
  const [event, participants] = await Promise.all([
    EventModel.findById(order.eventId).lean(),
    Participant.find({ orderId: order._id })
      .select("raceName size")
      .sort({ _id: 1 })
      .lean(),
  ]);
  return {
    orderNo: order.orderNo,
    event: event
      ? {
          slug: event.slug,
          name: event.name,
          date: event.date,
          venue: event.venue,
        }
      : null,
    races: participants.map((p) => ({ race: p.raceName, size: p.size })),
    amount: {
      subtotal: order.subtotal,
      shipping: order.shippingFee,
      total: order.amount,
    },
    delivery: order.delivery,
    status: order.status,
    createdAt: order.createdAt,
    ...(order.status === "pending" ? { expiresAt: order.expiresAt } : {}),
    ...(order.status === "rejected" && order.rejectionReason
      ? { rejectionReason: order.rejectionReason }
      : {}),
    canUploadSlip:
      statusesBefore("slip_uploaded").includes(order.status) &&
      !isOverduePending(order),
  };
}
