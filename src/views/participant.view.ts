import type { OrderLean } from "../models/order.model";
import type { ParticipantLean } from "../models/participant.model";
import { maskLast4 } from "../utils/crypto";
import { withId } from "../utils/lean";

/** Admin view of a participant: never exposes the encrypted ID, only its last 4 digits. */
export type ParticipantView = { id: string } & Omit<
  ParticipantLean,
  "_id" | "idNumberEnc" | "idLast4"
> & { idNumber: string };

export type ParticipantWithOrderView = ParticipantView & {
  orderNo: string;
  orderStatus: OrderLean["status"] | "";
};

export const toParticipantView = (p: ParticipantLean): ParticipantView => ({
  ...withId(p, ["idNumberEnc", "idLast4"]),
  idNumber: p.declineIdentity ? "" : maskLast4(p.idLast4),
});

/** Participant view + the order number/status it belongs to ("" when the order is missing). */
export const toParticipantWithOrderView = (
  p: ParticipantLean,
  order: Pick<OrderLean, "orderNo" | "status"> | undefined,
): ParticipantWithOrderView => ({
  ...toParticipantView(p),
  orderNo: order?.orderNo ?? "",
  orderStatus: order?.status ?? "",
});