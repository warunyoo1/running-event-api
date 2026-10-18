import type { OrderStatus } from "../../config/constants";

/** Single source of truth for the order state machine. */
export const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["slip_uploaded", "cancelled", "expired"],
  slip_uploaded: ["paid", "rejected", "cancelled", "slip_uploaded"],
  rejected: ["slip_uploaded", "cancelled"],
  paid: [],
  cancelled: [],
  expired: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  transitions[from].includes(to);

/** All statuses from which `to` is reachable. */
export const statusesBefore = (to: OrderStatus): OrderStatus[] =>
  (Object.keys(transitions) as OrderStatus[]).filter((from) =>
    canTransition(from, to),
  );

/**
 * Statuses in which a shipping address may still be edited. Shipping starts when a tracking
 * number is set (the only shipping marker in the model); cancelled and expired are final.
 */
export const ADDRESS_EDITABLE: readonly OrderStatus[] = [
  "pending",
  "slip_uploaded",
  "rejected",
  "paid",
];

export const canEditAddress = (o: {
  status?: OrderStatus | null;
  delivery?: string | null;
  trackingNo?: string | null;
}): boolean =>
  o.delivery === "shipping" &&
  o.status != null &&
  ADDRESS_EDITABLE.includes(o.status) &&
  !o.trackingNo;

/** Statuses that count against race quota (`reserved`). Rejected still holds quota. */
export const QUOTA_HOLDING: readonly OrderStatus[] = [
  "pending",
  "slip_uploaded",
  "paid",
  "rejected",
];
