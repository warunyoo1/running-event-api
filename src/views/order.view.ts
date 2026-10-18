import type { EventLean } from "../models/event.model";
import type { OrderLean } from "../models/order.model";
import type { ParticipantLean } from "../models/participant.model";
import type { PaymentLean } from "../models/payment.model";
import { withId } from "../utils/lean";
import {
  toParticipantView,
  type ParticipantView,
} from "./participant.view";
import { toPaymentView, type PaymentView } from "./payment.view";

/** Admin order: hides internal quota bookkeeping, adds event name/slug and participant count. */
export type AdminOrderView = { id: string } & Omit<
  OrderLean,
  "_id" | "raceCounts" | "quotaReleased"
> & {
    eventName: string;
    eventSlug: string;
    participantCount: number;
  };

export type AdminOrderDetailView = AdminOrderView & {
  participants: ParticipantView[];
  payments: PaymentView[];
};

type PublicOrderSource = Pick<
  OrderLean,
  | "orderNo"
  | "subtotal"
  | "shippingFee"
  | "amount"
  | "delivery"
  | "status"
  | "createdAt"
  | "expiresAt"
  | "rejectionReason"
>;

export interface PublicOrderView {
  orderNo: string;
  event: Pick<EventLean, "slug" | "name" | "date" | "venue"> | null;
  races: { race: string; size: string }[];
  amount: { subtotal: number; shipping: number; total: number };
  delivery: OrderLean["delivery"];
  status: OrderLean["status"];
  createdAt: Date;
  expiresAt?: OrderLean["expiresAt"];
  rejectionReason?: OrderLean["rejectionReason"];
  canUploadSlip: boolean;
}

/** Response of a successful checkout. */
export interface CreatedOrderView {
  orderNo: string;
  status: "pending";
  amount: { subtotal: number; shipping: number; total: number };
  expiresAt: Date;
}

export const toAdminOrderView = (
  o: OrderLean,
  event: Pick<EventLean, "name" | "slug"> | undefined,
  participantCount: number,
): AdminOrderView => ({
  ...withId(o, ["raceCounts", "quotaReleased"]),
  eventName: event?.name ?? "",
  eventSlug: event?.slug ?? "",
  participantCount,
});

export const toAdminOrderDetailView = (
  order: AdminOrderView,
  participants: readonly ParticipantLean[],
  payments: readonly PaymentLean[],
): AdminOrderDetailView => ({
  ...order,
  participants: participants.map((p) => toParticipantView(p)),
  payments: payments.map((p) => toPaymentView(p)),
});

export const toCreatedOrderView = (
  o: Pick<OrderLean, "orderNo" | "subtotal" | "shippingFee" | "amount"> & {
    expiresAt: Date;
  },
): CreatedOrderView => ({
  orderNo: o.orderNo,
  status: "pending",
  amount: { subtotal: o.subtotal, shipping: o.shippingFee, total: o.amount },
  expiresAt: o.expiresAt,
});

/** What the public "find my order" page sees. `expiresAt`/`rejectionReason` appear only when relevant. */
export const toPublicOrderView = (
  order: PublicOrderSource,
  event: Pick<EventLean, "slug" | "name" | "date" | "venue"> | null,
  participants: readonly Pick<ParticipantLean, "raceName" | "size">[],
  canUploadSlip: boolean,
): PublicOrderView => ({
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
  canUploadSlip,
});