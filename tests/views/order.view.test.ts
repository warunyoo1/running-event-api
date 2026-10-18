import { describe, expect, it } from "vitest";
import * as F from "../fixtures/view-fixtures";
import {
  toAdminOrderDetailView,
  toAdminOrderView,
  toPublicOrderView,
  type AdminOrderDetailExtras,
} from "../../src/views/order.view";

describe("toAdminOrderView", () => {
  it("hides quota bookkeeping and adds event name, slug and participant count", () => {
    const v = toAdminOrderView(F.paidOrder, F.event, 2);
    expect(v).not.toHaveProperty("raceCounts");
    expect(v).not.toHaveProperty("quotaReleased");
    expect(v).toMatchObject({ eventName: "Bangkok Run", eventSlug: "bangkok-run", participantCount: 2 });
    expect(Object.keys(v)[0]).toBe("id");
  });

  it("falls back to empty strings without an event", () => {
    expect(toAdminOrderView(F.paidOrder, undefined, 0)).toMatchObject({ eventName: "", eventSlug: "" });
  });
});

describe("toPublicOrderView", () => {
  it("shows expiresAt only while pending", () => {
    expect(toPublicOrderView(F.pendingOrder, F.event, F.participants, true)).toHaveProperty("expiresAt");
    expect(toPublicOrderView(F.paidOrder, F.event, F.participants, false)).not.toHaveProperty("expiresAt");
  });

  it("shows rejectionReason only for rejected orders that have one", () => {
    expect(toPublicOrderView(F.rejectedOrder, F.event, [], true).rejectionReason).toBe("blurry");
    expect(toPublicOrderView(F.pendingOrder, F.event, [], true)).not.toHaveProperty("rejectionReason");
    const noReason = { ...F.rejectedOrder, rejectionReason: undefined };
    expect(toPublicOrderView(noReason, F.event, [], true)).not.toHaveProperty("rejectionReason");
  });

  it("passes canUploadSlip through and handles a missing event", () => {
    const v = toPublicOrderView(F.paidOrder, null, [], false);
    expect(v.canUploadSlip).toBe(false);
    expect(v.event).toBeNull();
    expect(v.amount).toEqual({ subtotal: 800, shipping: 50, total: 850 });
  });
});

describe("toAdminOrderDetailView", () => {
  const base = () => toAdminOrderView(F.paidOrder, F.event, 2);
  const extras: AdminOrderDetailExtras = {
    reviewedByName: "Rita Reviewer",
    canEditAddress: false,
    notes: [],
    timeline: [],
  };

  it("without extras has exactly the original keys, with participants and payments last", () => {
    const keys = Object.keys(toAdminOrderDetailView(base(), F.participants, [F.payment]));
    expect(keys.slice(-2)).toEqual(["participants", "payments"]);
    expect(keys).not.toContain("reviewedByName");
    expect(keys).not.toContain("canEditAddress");
    expect(keys).not.toContain("notes");
    expect(keys).not.toContain("timeline");
  });

  it("with extras appends reviewedByName, canEditAddress, notes, timeline after payments", () => {
    const plain = toAdminOrderDetailView(base(), F.participants, [F.payment]);
    const full = toAdminOrderDetailView(base(), F.participants, [F.payment], extras);
    expect(Object.keys(full)).toEqual([
      ...Object.keys(plain),
      "reviewedByName",
      "canEditAddress",
      "notes",
      "timeline",
    ]);
    expect(JSON.stringify({ ...full, reviewedByName: undefined, canEditAddress: undefined, notes: undefined, timeline: undefined })).toBe(
      JSON.stringify(plain),
    );
    expect(full.reviewedByName).toBe("Rita Reviewer");
    expect(full.canEditAddress).toBe(false);
  });
});