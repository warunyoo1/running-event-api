import { describe, expect, it } from "vitest";
import { overviewRows, shirtSizeRows } from "../src/services/export.service";
import { CSV_BOM, toCsv } from "../src/utils/csv";
import type { DashboardView } from "../src/views/dashboard.view";
import type { ShirtSizeReportView } from "../src/views/report.view";

const dashboard: DashboardView = {
  orders: {
    pending: 1,
    slip_uploaded: 2,
    paid: 3,
    rejected: 0,
    expired: 0,
    cancelled: 0,
  },
  totalOrders: 6,
  pendingReview: 2,
  paidRevenue: 4500,
  participants: 7,
  races: [
    {
      raceId: "r1",
      eventId: "e1",
      eventName: "Bangkok Run",
      name: "10K",
      price: 600,
      quota: 100,
      reserved: 7,
      remaining: 93,
    },
  ],
};

describe("overviewRows", () => {
  it("builds the rows the browser used to build", () => {
    expect(overviewRows(dashboard)).toEqual([
      ["รายการ", "จำนวน"],
      ["ที่นั่งที่จอง", 7],
      ["ยอดชำระแล้ว", 4500],
      ["สลิปรอตรวจ", 2],
      ["Bangkok Run · 10K (จอง/โควตา)", "7/100"],
    ]);
  });
  it("renders a BOM CSV with quoted cells", () => {
    const csv = toCsv(overviewRows(dashboard));
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toContain('"ที่นั่งที่จอง","7"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

describe("shirtSizeRows", () => {
  it("lists every size in order, zeros included", () => {
    const report: ShirtSizeReportView = {
      status: "paid",
      sizes: [
        { size: "S", count: 2 },
        { size: "M", count: 0 },
      ],
      total: 2,
      byRace: [],
    };
    expect(shirtSizeRows(report)).toEqual([
      ["ไซซ์เสื้อ", "จำนวน"],
      ["S", 2],
      ["M", 0],
    ]);
  });
});
