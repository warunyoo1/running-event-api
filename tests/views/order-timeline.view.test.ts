import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import type { AuditLogLean } from "../../src/models/audit-log.model";
import type { OrderLean } from "../../src/models/order.model";
import type { OrderNoteLean } from "../../src/models/order-note.model";
import type { PaymentLean } from "../../src/models/payment.model";
import {
  TIMELINE_AUDIT_ACTIONS,
  toOrderTimelineView,
  type TimelineSource,
} from "../../src/views/order-timeline.view";
import * as F from "../fixtures/view-fixtures";

const oid = (n: number) => new Types.ObjectId(n.toString(16).padStart(24, "0"));
const at = (hhmm: string) => new Date(`2026-03-05T${hhmm}:00.000Z`);

const REVIEWER = oid(900);
const AUTHOR = oid(901);
const names = new Map([
  [String(REVIEWER), "Rita Reviewer"],
  [String(AUTHOR), "Nok Author"],
]);

const order = (over: Partial<OrderLean> = {}) =>
  ({
    ...F.pendingOrder,
    createdAt: at("01:00"),
    updatedAt: at("09:00"),
    expiresAt: at("23:00"),
    ...over,
  }) as OrderLean;

const payment = (n: number, over: Record<string, unknown>) =>
  ({
    _id: oid(n),
    orderId: F.ORDER_ID,
    slipPath: "secret/slip.jpg",
    slipMime: "image/jpeg",
    amount: 850,
    status: "submitted",
    createdAt: at("02:00"),
    updatedAt: at("02:00"),
    ...over,
  }) as unknown as PaymentLean;

const note = (n: number, text: string, created: string, authorId = AUTHOR) =>
  ({ _id: oid(n), orderId: F.ORDER_ID, authorId, text, createdAt: at(created) }) as unknown as OrderNoteLean;

const auditRow = (
  n: number,
  action: string,
  created: string,
  meta: Record<string, unknown> | undefined,
  userId: Types.ObjectId | null = REVIEWER,
) =>
  ({ _id: oid(n), userId, action, entity: "Order", entityId: String(F.ORDER_ID), meta, createdAt: at(created) }) as unknown as AuditLogLean;

const build = (over: Partial<TimelineSource> = {}) =>
  toOrderTimelineView({ order: order(), payments: [], notes: [], audit: [], names, ...over });

describe("toOrderTimelineView", () => {
  it("always has the created entry, even for a bare order", () => {
    expect(build()).toEqual([
      { id: "created", kind: "created", at: at("01:00"), actor: null, detail: null },
    ]);
  });

  it("is sorted ascending, has unique ids and ignores input order", () => {
    const rows = {
      payments: [
        payment(41, { status: "approved", transactionRef: "REF-2", reviewedAt: at("05:00"), createdAt: at("04:00") }),
        payment(40, { status: "rejected", rejectReason: "blurry", reviewedBy: REVIEWER, reviewedAt: at("03:00"), createdAt: at("02:00") }),
      ],
      notes: [note(60, "later", "08:00"), note(61, "earlier", "06:00")],
      audit: [
        auditRow(70, "order.tracking", "07:00", { provider: "Kerry", trackingNo: "T1" }),
        auditRow(71, "order.address.update", "06:30", { before: null, after: null }),
      ],
      order: order({ status: "paid", paidAt: at("05:00"), reviewedBy: REVIEWER }),
    };
    const forward = build(rows);
    const reversed = build({
      ...rows,
      payments: [...rows.payments].reverse(),
      notes: [...rows.notes].reverse(),
      audit: [...rows.audit].reverse(),
    });
    expect(reversed).toEqual(forward);
    const times = forward.map((e) => e.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(forward.map((e) => e.id)).size).toBe(forward.length);
    expect(forward.map((e) => e.kind)).toEqual([
      "created",
      "slip_uploaded",
      "slip_rejected",
      "slip_uploaded",
      "paid",
      "note",
      "address_updated",
      "tracking_set",
      "note",
    ]);
  });

  it("turns a rejected payment into slip_rejected with the reviewer name and reason", () => {
    const entries = build({
      payments: [payment(40, { status: "rejected", rejectReason: "blurry", reviewedBy: REVIEWER, reviewedAt: at("03:00") })],
    });
    expect(entries.find((e) => e.kind === "slip_rejected")).toEqual({
      id: `payment:${String(oid(40))}:rejected`,
      kind: "slip_rejected",
      at: at("03:00"),
      actor: { id: String(REVIEWER), name: "Rita Reviewer" },
      detail: "blurry",
    });
    expect(entries.find((e) => e.kind === "slip_uploaded")?.actor).toBeNull();
  });

  describe("paid entry", () => {
    const paid = order({ status: "paid", paidAt: at("05:00"), reviewedBy: REVIEWER, transactionRef: "ORDER-REF" });

    it("uses the approved payment's transactionRef and ignores a superseded one", () => {
      const entries = build({
        order: paid,
        payments: [
          payment(40, { status: "superseded", transactionRef: "OLD-REF", reviewedAt: at("06:00") }),
          payment(41, { status: "approved", transactionRef: "NEW-REF", reviewedAt: at("05:00"), createdAt: at("04:00") }),
        ],
      });
      expect(entries.find((e) => e.kind === "paid")).toEqual({
        id: "paid",
        kind: "paid",
        at: paid.paidAt,
        actor: { id: String(REVIEWER), name: "Rita Reviewer" },
        detail: "NEW-REF",
      });
    });

    it("picks the latest approved payment by reviewedAt", () => {
      const entries = build({
        order: paid,
        payments: [
          payment(40, { status: "approved", transactionRef: "FIRST", reviewedAt: at("03:00") }),
          payment(41, { status: "approved", transactionRef: "LAST", reviewedAt: at("05:00") }),
        ],
      });
      expect(entries.find((e) => e.kind === "paid")?.detail).toBe("LAST");
    });

    it("has detail null without an approved payment", () => {
      const entries = build({
        order: paid,
        payments: [payment(40, { status: "superseded", transactionRef: "OLD-REF", reviewedAt: at("06:00") })],
      });
      expect(entries.find((e) => e.kind === "paid")?.detail).toBeNull();
    });

    it("has no paid entry before the order is paid", () => {
      expect(build().some((e) => e.kind === "paid")).toBe(false);
    });
  });

  it("address_updated has detail null while the audit meta keeps the addresses", () => {
    const meta = { before: { street: "1 Old Rd" }, after: { street: "2 New Rd" } };
    const entries = build({ audit: [auditRow(70, "order.address.update", "04:00", meta)] });
    const entry = entries.find((e) => e.kind === "address_updated");
    expect(entry).toEqual({
      id: `audit:${String(oid(70))}`,
      kind: "address_updated",
      at: at("04:00"),
      actor: { id: String(REVIEWER), name: "Rita Reviewer" },
      detail: null,
    });
    expect(JSON.stringify(entries)).not.toContain("New Rd");
  });

  describe("cancelled entry", () => {
    it("comes from the order.cancel audit row with the reason", () => {
      const entries = build({
        order: order({ status: "cancelled", cancelReason: "from order" }),
        audit: [auditRow(70, "order.cancel", "04:00", { reason: "customer asked" })],
      });
      const cancelled = entries.filter((e) => e.kind === "cancelled");
      expect(cancelled).toEqual([
        { id: `audit:${String(oid(70))}`, kind: "cancelled", at: at("04:00"), actor: { id: String(REVIEWER), name: "Rita Reviewer" }, detail: "customer asked" },
      ]);
    });

    it("falls back to updatedAt and cancelReason for legacy orders without an audit row", () => {
      const entries = build({ order: order({ status: "cancelled", cancelReason: "legacy" }) });
      expect(entries.filter((e) => e.kind === "cancelled")).toEqual([
        { id: "cancelled", kind: "cancelled", at: at("09:00"), actor: null, detail: "legacy" },
      ]);
    });
  });

  describe("expired entry", () => {
    it("uses expiresAt, or updatedAt when it is missing", () => {
      expect(build({ order: order({ status: "expired" }) }).find((e) => e.kind === "expired")?.at).toEqual(at("23:00"));
      expect(
        build({ order: order({ status: "expired", expiresAt: undefined }) }).find((e) => e.kind === "expired")?.at,
      ).toEqual(at("09:00"));
    });
  });

  describe("tracking_set entry", () => {
    it("shows provider · trackingNo, and only the provider for old audit rows", () => {
      const entries = build({
        audit: [
          auditRow(70, "order.tracking", "04:00", { provider: "Kerry", trackingNo: "T123" }),
          auditRow(71, "order.tracking", "05:00", { provider: "Flash" }),
        ],
      });
      expect(entries.filter((e) => e.kind === "tracking_set").map((e) => e.detail)).toEqual(["Kerry · T123", "Flash"]);
    });
  });

  it("gives unknown or deleted users and system rows actor null", () => {
    const entries = build({
      order: order({ status: "paid", paidAt: at("05:00"), reviewedBy: oid(999) }),
      notes: [note(60, "orphan", "06:00", oid(998))],
      audit: [auditRow(70, "order.tracking", "07:00", { provider: "Kerry", trackingNo: "T1" }, null)],
    });
    for (const kind of ["paid", "note", "tracking_set"] as const)
      expect(entries.find((e) => e.kind === kind)?.actor).toBeNull();
  });

  it("makes one note entry per note with the author and text", () => {
    const entries = build({ notes: [note(60, "call back tomorrow", "06:00")] });
    expect(entries.filter((e) => e.kind === "note")).toEqual([
      { id: `note:${String(oid(60))}`, kind: "note", at: at("06:00"), actor: { id: String(AUTHOR), name: "Nok Author" }, detail: "call back tomorrow" },
    ]);
  });

  it("produces no entries for order.note.*, approve and reject audit rows", () => {
    const entries = build({
      audit: [
        auditRow(70, "order.note.add", "04:00", { noteId: "n1" }),
        auditRow(71, "order.note.delete", "05:00", { noteId: "n1", authorId: "a" }),
        auditRow(72, "order.approve", "06:00", {}),
        auditRow(73, "order.reject", "07:00", {}),
      ],
    });
    expect(entries.map((e) => e.kind)).toEqual(["created"]);
  });

  it("exports the audit actions that feed the timeline", () => {
    expect([...TIMELINE_AUDIT_ACTIONS]).toEqual(["order.cancel", "order.tracking", "order.address.update"]);
  });
});
