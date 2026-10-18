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

/** Statuses that count against race quota (`reserved`). Rejected still holds quota. */
export const QUOTA_HOLDING: readonly OrderStatus[] = [
  "pending",
  "slip_uploaded",
  "paid",
  "rejected",
];
