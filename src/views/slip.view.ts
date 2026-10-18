import type { OrderLean } from "../models/order.model";
import type { PaymentLean } from "../models/payment.model";

/** Order of the slip queue, with `eventId` populated to `{ name }` (null when the event is gone). */
export type SlipQueueOrderSource = Pick<
  OrderLean,
  | "_id"
  | "orderNo"
  | "contactName"
  | "amount"
  | "status"
  | "slipUploadedAt"
  | "reviewedAt"
  | "rejectionReason"
  | "transactionRef"
> & { eventId?: { name: string } | null };

export interface SlipQueueRowView {
  orderId: string;
  orderNo: string;
  eventName: string;
  contactName: string;
  amount: number;
  status: OrderLean["status"];
  slipUploadedAt: OrderLean["slipUploadedAt"];
  reviewedAt: OrderLean["reviewedAt"];
  rejectionReason: OrderLean["rejectionReason"];
  transactionRef: OrderLean["transactionRef"];
  paymentId: string | null;
}

/** Response of a slip upload. */
export interface SlipSubmittedView {
  orderNo: string;
  status: "slip_uploaded";
}

export const toSlipSubmittedView = (
  o: Pick<OrderLean, "orderNo">,
): SlipSubmittedView => ({ orderNo: o.orderNo, status: "slip_uploaded" });

/** `latestPayment` is the newest payment of the order, if any. */
export const toSlipQueueRowView = (
  o: SlipQueueOrderSource,
  latestPayment: Pick<PaymentLean, "_id"> | undefined,
): SlipQueueRowView => ({
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
  paymentId: latestPayment ? String(latestPayment._id) : null,
});