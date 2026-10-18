import { orderStatuses, type OrderStatus } from "../config/constants";
import type { RaceLean } from "../models/race.model";
import { toRaceStatView, type RaceStatView } from "./race.view";

/** `$group` row of orders by status. */
export interface OrderStatusCountRow {
  _id: string;
  n: number;
}

export interface DashboardView {
  orders: Record<OrderStatus, number>;
  totalOrders: number;
  pendingReview: number;
  paidRevenue: number;
  participants: number;
  races: RaceStatView[];
}

export function toDashboardView(
  byStatus: readonly OrderStatusCountRow[],
  paidRevenue: number,
  races: readonly RaceLean[],
  eventNames: ReadonlyMap<string, string>,
): DashboardView {
  const orders = Object.fromEntries(
    orderStatuses.map((s) => [s, byStatus.find((b) => b._id === s)?.n ?? 0]),
  ) as Record<OrderStatus, number>;
  return {
    orders,
    totalOrders: Object.values(orders).reduce((a, b) => a + b, 0),
    pendingReview: orders.slip_uploaded,
    paidRevenue,
    // Seats held by quota-holding orders (pending/slip_uploaded/rejected included, not just paid).
    participants: races.reduce((a, r) => a + r.reserved, 0),
    races: races.map((r) =>
      toRaceStatView(r, eventNames.get(String(r.eventId)) ?? ""),
    ),
  };
}