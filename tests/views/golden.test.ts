import { describe, expect, it } from "vitest";
import golden from "../fixtures/golden-views.json";
import * as F from "../fixtures/view-fixtures";
import { toDashboardView } from "../../src/views/dashboard.view";
import { toAdminEventView, toPublicEventView } from "../../src/views/event.view";
import { toAdminImageViews, toPublicImageViews } from "../../src/views/event-image.view";
import { toAdminOrderDetailView, toAdminOrderView, toPublicOrderView } from "../../src/views/order.view";
import { toParticipantView, toParticipantWithOrderView } from "../../src/views/participant.view";
import { toRaceViews } from "../../src/views/race.view";
import { toReportSummaryView, toShirtSizeReportView } from "../../src/views/report.view";
import { toShippingRowView } from "../../src/views/shipping.view";
import { toSlipQueueRowView } from "../../src/views/slip.view";
import { toPaymentView } from "../../src/views/payment.view";

/**
 * Byte-equality guard: `golden-views.json` holds the JSON (key order included) that the
 * pre-refactor inline mappers produced for these fixtures. Compared as strings on purpose.
 */
const g: Record<string, string> = golden;
const evName = new Map([[String(F.EVENT_ID), "Bangkok Run"]]);

describe("views match the pre-refactor JSON byte for byte", () => {
  const cases: [string, () => unknown][] = [
    ["races", () => toRaceViews(F.races)],
    ["publicImages", () => toPublicImageViews(F.event)],
    ["adminImages", () => toAdminImageViews(F.event)],
    ["publicEvent", () => toPublicEventView(F.event, F.races)],
    ["publicEventNoImages", () => toPublicEventView(F.eventWithoutImages, F.races)],
    ["adminEvent", () => toAdminEventView(F.event, F.races, 3)],
    ["adminEventNoOrders", () => toAdminEventView(F.eventWithoutImages, [], 0)],
    ["participants", () => F.participants.map((p) => toParticipantView(p))],
    ["participantWithOrder", () => toParticipantWithOrderView(F.participants[0], F.paidOrder)],
    ["participantNoOrder", () => toParticipantWithOrderView(F.participants[1], undefined)],
    ["adminOrder", () => toAdminOrderView(F.paidOrder, F.event, 2)],
    ["adminOrderNoEvent", () => toAdminOrderView(F.pendingOrder, undefined, 0)],
    [
      "adminOrderDetail",
      () => toAdminOrderDetailView(toAdminOrderView(F.paidOrder, F.event, 2), F.participants, [F.payment]),
    ],
    ["publicPending", () => toPublicOrderView(F.pendingOrder, F.event, F.participants, true)],
    ["publicRejected", () => toPublicOrderView(F.rejectedOrder, F.event, F.participants, true)],
    ["publicPaid", () => toPublicOrderView(F.paidOrder, null, [], false)],
    ["shipping", () => toShippingRowView(F.paidOrder, F.participants)],
    [
      "shippingEmpty",
      () => toShippingRowView({ ...F.paidOrder, address: undefined, trackingNo: undefined }, []),
    ],
    ["slipWithPayment", () => toSlipQueueRowView({ ...F.rejectedOrder, eventId: { name: "Bangkok Run" } }, F.payment)],
    ["slipNoPayment", () => toSlipQueueRowView({ ...F.pendingOrder, eventId: null }, undefined)],
    [
      "dashboard",
      () => toDashboardView([{ _id: "paid", n: 3 }, { _id: "slip_uploaded", n: 2 }], 2550, F.races, evName),
    ],
    [
      "reportSummary",
      () =>
        toReportSummaryView(
          [{ _id: "paid", n: 2, amount: 1700 }, { _id: "pending", n: 1, amount: 300 }],
          [{ _id: { eventId: F.EVENT_ID, race: "10K" }, participants: 3, paidParticipants: 2, revenue: 1000 }],
          evName,
        ),
    ],
    [
      "shirtSizes",
      () =>
        toShirtSizeReportView("paid", [
          { _id: { race: "5K", size: "M" }, n: 2 },
          { _id: { race: "10K", size: "M" }, n: 1 },
          { _id: { race: "10K", size: "XL" }, n: 4 },
        ]),
    ],
    ["shirtSizesEmpty", () => toShirtSizeReportView("paid", [])],
  ];

  it("covers every golden entry", () => {
    expect(Object.keys(g).sort()).toEqual(cases.map(([name]) => name).sort());
  });

  for (const [name, build] of cases) {
    it(name, () => expect(JSON.stringify(build())).toBe(g[name]));
  }

  it("payment view hides the slip path", () => {
    expect(Object.keys(toPaymentView(F.payment))).not.toContain("slipPath");
  });
});