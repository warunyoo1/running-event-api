import type { OrderAddress, OrderLean } from "../models/order.model";
import type { ParticipantLean } from "../models/participant.model";

type ShippingOrderSource = Pick<
  OrderLean,
  | "_id"
  | "eventId"
  | "orderNo"
  | "contactName"
  | "contactPhone"
  | "delivery"
  | "address"
  | "trackingProvider"
  | "trackingNo"
>;

type ShippingParticipantSource = Pick<
  ParticipantLean,
  "_id" | "firstName" | "lastName" | "raceName" | "size" | "bibNo" | "collected"
>;

export interface ShippingParticipantView {
  id: string;
  name: string;
  race: string;
  size: string;
  bibNo: string | null;
  collected: boolean;
}

export interface ShippingRowView {
  orderId: string;
  orderNo: string;
  eventId: string;
  contactName: string;
  contactPhone: string;
  delivery: OrderLean["delivery"];
  address: OrderAddress | null;
  trackingProvider: string | null;
  trackingNo: string | null;
  participants: ShippingParticipantView[];
  allCollected: boolean;
}

const toShippingParticipantView = (
  p: ShippingParticipantSource,
): ShippingParticipantView => ({
  id: String(p._id),
  name: `${p.firstName} ${p.lastName}`,
  race: p.raceName,
  size: p.size,
  bibNo: p.bibNo ?? null,
  collected: p.collected,
});

/** One paid order with its participants, as the fulfillment (pickup/shipping) list needs it. */
export const toShippingRowView = (
  o: ShippingOrderSource,
  participants: readonly ShippingParticipantSource[],
): ShippingRowView => ({
  orderId: String(o._id),
  orderNo: o.orderNo,
  eventId: String(o.eventId),
  contactName: o.contactName,
  contactPhone: o.contactPhone,
  delivery: o.delivery,
  address: o.address ?? null,
  trackingProvider: o.trackingProvider ?? null,
  trackingNo: o.trackingNo ?? null,
  participants: participants.map((p) => toShippingParticipantView(p)),
  allCollected: participants.length > 0 && participants.every((p) => p.collected),
});