import type { Types } from "mongoose";
import { shirtSizes } from "../config/constants";

/** `$group` row of quota-holding orders by status. */
export interface SummaryTotalsRow {
  _id: string;
  n: number;
  amount: number;
}

/** `$group` row of participants by event and race. */
export interface SummaryRaceRow {
  _id: { eventId: Types.ObjectId; race: string };
  participants: number;
  paidParticipants: number;
  revenue: number;
}

/** `$group` row of participants by race and shirt size. */
export interface ShirtSizeRow {
  _id: { race: string; size: string };
  n: number;
}

export interface ReportSummaryView {
  totals: { orders: number; paidOrders: number; paidRevenue: number };
  rows: {
    eventId: string;
    eventName: string;
    race: string;
    participants: number;
    paidParticipants: number;
    revenue: number;
  }[];
}

export interface ShirtSizeReportView {
  status: string;
  sizes: { size: string; count: number }[];
  total: number;
  byRace: { race: string; sizes: Record<string, number> }[];
}

export function toReportSummaryView(
  totalsRows: readonly SummaryTotalsRow[],
  rows: readonly SummaryRaceRow[],
  eventNames: ReadonlyMap<string, string>,
): ReportSummaryView {
  const paid = totalsRows.find((r) => r._id === "paid");
  return {
    totals: {
      orders: totalsRows.reduce((a, r) => a + r.n, 0),
      paidOrders: paid?.n ?? 0,
      paidRevenue: paid?.amount ?? 0,
    },
    rows: rows.map((r) => ({
      eventId: String(r._id.eventId),
      eventName: eventNames.get(String(r._id.eventId)) ?? "",
      race: r._id.race,
      participants: r.participants,
      paidParticipants: r.paidParticipants,
      revenue: r.revenue,
    })),
  };
}

export function toShirtSizeReportView(
  status: string,
  rows: readonly ShirtSizeRow[],
): ShirtSizeReportView {
  const sizes = shirtSizes.map((size) => ({
    size,
    count: rows.filter((r) => r._id.size === size).reduce((a, r) => a + r.n, 0),
  }));
  const races = [...new Set(rows.map((r) => r._id.race))].sort();
  return {
    status,
    sizes,
    total: sizes.reduce((a, s) => a + s.count, 0),
    byRace: races.map((race) => ({
      race,
      sizes: Object.fromEntries(
        shirtSizes.map((size) => [
          size,
          rows.find((r) => r._id.race === race && r._id.size === size)?.n ?? 0,
        ]),
      ),
    })),
  };
}