import type { FilterQuery, UpdateQuery } from "mongoose";
import { Order, Payment } from "../models";
import type { OrderDoc } from "../models/order.model";
import { ApiError } from "../utils/api-error";
import type { PageMeta } from "../types/api";
import { pageMeta, skipOf } from "../utils/pagination";
import type { SlipsQuery } from "../validators/admin.validator";
import type { AdminOrderDetailView } from "../views/order.view";
import { toSlipQueueRowView, type SlipQueueRowView } from "../views/slip.view";
import { audit } from "./audit.service";
import { findOrderOr404, getAdmin } from "./order/order-admin.service";

const APPROVE_INVALID_STATE = "อนุมัติได้เฉพาะออเดอร์ที่รอตรวจสลิป";
const REJECT_INVALID_STATE = "ปฏิเสธได้เฉพาะออเดอร์ที่รอตรวจสลิป";

/**
 * Applies a slip review: moves the order out of `slip_uploaded`
 * (INVALID_STATE if it already left) and updates its latest submitted payment.
 */
async function reviewSlip(
  id: string,
  orderUpdate: UpdateQuery<OrderDoc>,
  paymentSet: Record<string, unknown>,
  invalidStateMessage: string,
): Promise<void> {
  // The order update is the guarded step (only one reviewer wins); the payment update follows it.
  const res = await Order.updateOne(
    { _id: id, status: "slip_uploaded" },
    orderUpdate,
  );
  if (res.modifiedCount === 0)
    throw ApiError.conflict("INVALID_STATE", invalidStateMessage);
  await Payment.findOneAndUpdate(
    { orderId: id, status: "submitted" },
    { $set: paymentSet },
    { sort: { createdAt: -1 } },
  );
}

export async function approve(
  actorId: string,
  id: string,
  rawRef: string,
): Promise<AdminOrderDetailView> {
  const transactionRef = rawRef.trim().toUpperCase(); // normalised so case variants can't bypass duplicate check
  const order = await findOrderOr404(id, "status");
  if (order.status !== "slip_uploaded")
    throw ApiError.conflict("INVALID_STATE", APPROVE_INVALID_STATE);
  if (
    await Order.exists({ status: "paid", transactionRef, _id: { $ne: id } })
  ) {
    throw ApiError.conflict(
      "DUPLICATE_TRANSACTION_REF",
      "เลขอ้างอิงนี้ถูกใช้กับออเดอร์ที่ชำระแล้ว",
    );
  }
  const now = new Date();
  const reviewed = { reviewedBy: actorId, reviewedAt: now };
  await reviewSlip(
    id,
    {
      $set: { status: "paid", paidAt: now, transactionRef, ...reviewed },
      $unset: { rejectionReason: "" },
    },
    { status: "approved", transactionRef, ...reviewed },
    APPROVE_INVALID_STATE,
  );
  await audit(actorId, "order.approve", "Order", id, { transactionRef });
  return getAdmin(id);
}

export async function reject(
  actorId: string,
  id: string,
  reason: string,
): Promise<AdminOrderDetailView> {
  await findOrderOr404(id, "status");
  const now = new Date();
  const reviewed = { reviewedBy: actorId, reviewedAt: now };
  await reviewSlip(
    id,
    { $set: { status: "rejected", rejectionReason: reason, ...reviewed } },
    { status: "rejected", rejectReason: reason, ...reviewed },
    REJECT_INVALID_STATE,
  );
  await audit(actorId, "order.reject", "Order", id, { reason });
  return getAdmin(id);
}

export async function listSlips(
  q: SlipsQuery,
): Promise<{ data: SlipQueueRowView[]; meta: PageMeta }> {
  const filter: FilterQuery<OrderDoc> =
    q.tab === "waiting"
      ? { status: "slip_uploaded" }
      : { status: { $in: ["paid", "rejected"] } };
  if (q.eventId) filter.eventId = q.eventId;
  const sort: Record<string, 1 | -1> =
    q.tab === "waiting" ? { slipUploadedAt: 1 } : { reviewedAt: -1 };
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort(sort)
      .skip(skipOf(q))
      .limit(q.pageSize)
      .populate<{ eventId: { name: string } }>("eventId", "name")
      .lean(),
    Order.countDocuments(filter),
  ]);
  const payments = await Payment.find({
    orderId: { $in: orders.map((o) => o._id) },
  })
    .sort({ createdAt: -1 })
    .lean();
  // Payments are newest first, so the first one seen per order is its latest.
  const latest = new Map<string, (typeof payments)[number]>();
  for (const p of payments)
    if (!latest.has(String(p.orderId))) latest.set(String(p.orderId), p);
  const data = orders.map((o) =>
    toSlipQueueRowView(o, latest.get(String(o._id))),
  );
  return { data, meta: pageMeta(q, total) };
}
