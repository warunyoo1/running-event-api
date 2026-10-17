import type { FilterQuery } from "mongoose";
import { Order, Payment } from "../models";
import type { OrderDoc } from "../models/order.model";
import { ApiError } from "../utils/api-error";
import { pageMeta, skipOf } from "../utils/pagination";
import { withTransaction } from "../utils/transaction";
import { audit } from "./audit.service";
import { getAdmin } from "./order.service";

export async function approve(actorId: string, id: string, rawRef: string) {
  const transactionRef = rawRef.trim().toUpperCase(); // normalised so case variants can't bypass duplicate check
  const order = await Order.findById(id).select("status");
  if (!order) throw ApiError.notFound("ไม่พบออเดอร์", "ORDER_NOT_FOUND");
  if (order.status !== "slip_uploaded")
    throw ApiError.conflict(
      "INVALID_STATE",
      "อนุมัติได้เฉพาะออเดอร์ที่รอตรวจสลิป",
    );
  if (
    await Order.exists({ status: "paid", transactionRef, _id: { $ne: id } })
  ) {
    throw ApiError.conflict(
      "DUPLICATE_TRANSACTION_REF",
      "เลขอ้างอิงนี้ถูกใช้กับออเดอร์ที่ชำระแล้ว",
    );
  }
  const now = new Date();
  await withTransaction(async (session) => {
    const res = await Order.updateOne(
      { _id: id, status: "slip_uploaded" },
      {
        $set: {
          status: "paid",
          paidAt: now,
          transactionRef,
          reviewedBy: actorId,
          reviewedAt: now,
        },
        $unset: { rejectionReason: "" },
      },
      { session },
    );
    if (res.modifiedCount === 0)
      throw ApiError.conflict(
        "INVALID_STATE",
        "อนุมัติได้เฉพาะออเดอร์ที่รอตรวจสลิป",
      );
    await Payment.findOneAndUpdate(
      { orderId: id, status: "submitted" },
      {
        $set: {
          status: "approved",
          transactionRef,
          reviewedBy: actorId,
          reviewedAt: now,
        },
      },
      { session, sort: { createdAt: -1 } },
    );
  });
  await audit(actorId, "order.approve", "Order", id, { transactionRef });
  return getAdmin(id);
}

export async function reject(actorId: string, id: string, reason: string) {
  const order = await Order.findById(id).select("status");
  if (!order) throw ApiError.notFound("ไม่พบออเดอร์", "ORDER_NOT_FOUND");
  const now = new Date();
  await withTransaction(async (session) => {
    const res = await Order.updateOne(
      { _id: id, status: "slip_uploaded" },
      {
        $set: {
          status: "rejected",
          rejectionReason: reason,
          reviewedBy: actorId,
          reviewedAt: now,
        },
      },
      { session },
    );
    if (res.modifiedCount === 0)
      throw ApiError.conflict(
        "INVALID_STATE",
        "ปฏิเสธได้เฉพาะออเดอร์ที่รอตรวจสลิป",
      );
    await Payment.findOneAndUpdate(
      { orderId: id, status: "submitted" },
      {
        $set: {
          status: "rejected",
          rejectReason: reason,
          reviewedBy: actorId,
          reviewedAt: now,
        },
      },
      { session, sort: { createdAt: -1 } },
    );
  });
  await audit(actorId, "order.reject", "Order", id, { reason });
  return getAdmin(id);
}

export async function listSlips(q: {
  page: number;
  pageSize: number;
  eventId?: string;
  tab: "waiting" | "history";
}) {
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
  const latest = new Map<string, (typeof payments)[number]>();
  for (const p of payments)
    if (!latest.has(String(p.orderId))) latest.set(String(p.orderId), p);
  const data = orders.map((o) => ({
    orderId: String(o._id),
    orderNo: o.orderNo,
    eventName: o.eventId?.name ?? "",
    contactName: o.contactName,
    amount: o.amount,
    status: o.status,
    slipUploadedAt: o.slipUploadedAt,
    reviewedAt: o.reviewedAt,
    rejectionReason: o.rejectionReason,
    transactionRef: o.transactionRef,
    paymentId: latest.has(String(o._id))
      ? String(latest.get(String(o._id))!._id)
      : null,
  }));
  return { data, meta: pageMeta(q, total) };
}
