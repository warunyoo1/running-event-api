import { describe, expect, it } from "vitest";
import * as F from "../fixtures/view-fixtures";
import { toAdminOrderView, toPublicOrderView } from "../../src/views/order.view";

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