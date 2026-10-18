import type { AuditLogLean } from "../models/audit-log.model";
import type { OrderLean } from "../models/order.model";
import type { OrderNoteLean } from "../models/order-note.model";
import type { PaymentLean } from "../models/payment.model";

export const timelineKinds = [
  "created",
  "slip_uploaded",
  "slip_rejected",
  "paid",
  "cancelled",
  "expired",
  "tracking_set",
  "address_updated",
  "note",
] as const;
export type TimelineKind = (typeof timelineKinds)[number];

/** Audit actions that become timeline entries. Notes and payments represent order.note.*, approve and reject. */
export const TIMELINE_AUDIT_ACTIONS = [
  "order.cancel",
  "order.tracking",
  "order.address.update",
] as const;

export interface OrderTimelineEntry {
  id: string;
  kind: TimelineKind;
  at: Date;
  actor: { id: string; name: string } | null;
  detail: string | null;
}

export type TimelineOrder = Pick<
  OrderLean,
  | "createdAt"
  | "updatedAt"
  | "status"
  | "expiresAt"
  | "paidAt"
  | "reviewedBy"
  | "cancelReason"
>;

export interface TimelineSource {
  order: TimelineOrder;
  payments: readonly PaymentLean[];
  notes: readonly OrderNoteLean[];
  audit: readonly AuditLogLean[];
  /** User id to display name. */
  names: ReadonlyMap<string, string>;
}

/** Tie-break for entries with the same instant. */
const RANK: Record<TimelineKind, number> = {
  created: 0,
  slip_uploaded: 1,
  slip_rejected: 2,
  paid: 3,
  tracking_set: 4,
  address_updated: 5,
  note: 6,
  cancelled: 7,
  expired: 8,
};

const timeOf = (d: Date | null | undefined): number => (d ? d.getTime() : 0);

const metaText = (meta: unknown, key: string): string | null => {
  if (meta === null || typeof meta !== "object") return null;
  const value = (meta as Record<string, unknown>)[key];
  return typeof value === "string" && value !== "" ? value : null;
};

/** Newest approved payment (by `reviewedAt`); superseded, rejected and submitted payments are ignored. */
const approvedPayment = (payments: readonly PaymentLean[]): PaymentLean | undefined =>
  payments
    .filter((p) => p.status === "approved")
    .reduce<PaymentLean | undefined>(
      (best, p) => (best === undefined || timeOf(p.reviewedAt) > timeOf(best.reviewedAt) ? p : best),
      undefined,
    );

/** Pure: builds the ascending order timeline from already-loaded rows. No DB, no clock. */
export function toOrderTimelineView(src: TimelineSource): OrderTimelineEntry[] {
  const { order, payments, notes, audit, names } = src;
  const actorOf = (userId: unknown): OrderTimelineEntry["actor"] => {
    if (userId === null || userId === undefined) return null;
    const id = String(userId);
    const name = names.get(id);
    return name === undefined ? null : { id, name };
  };
  const entries: OrderTimelineEntry[] = [
    { id: "created", kind: "created", at: order.createdAt, actor: null, detail: null },
  ];

  for (const p of payments) {
    const pid = String(p._id);
    entries.push({
      id: `payment:${pid}:uploaded`,
      kind: "slip_uploaded",
      at: p.createdAt,
      actor: null,
      detail: null,
    });
    if (p.status === "rejected" && p.reviewedAt)
      entries.push({
        id: `payment:${pid}:rejected`,
        kind: "slip_rejected",
        at: p.reviewedAt,
        actor: actorOf(p.reviewedBy),
        detail: p.rejectReason ?? null,
      });
  }

  if (order.paidAt)
    entries.push({
      id: "paid",
      kind: "paid",
      at: order.paidAt,
      actor: actorOf(order.reviewedBy),
      detail: approvedPayment(payments)?.transactionRef ?? null,
    });

  let hasCancelAudit = false;
  for (const a of audit) {
    const id = `audit:${String(a._id)}`;
    const actor = actorOf(a.userId);
    if (a.action === "order.cancel") {
      hasCancelAudit = true;
      entries.push({ id, kind: "cancelled", at: a.createdAt, actor, detail: metaText(a.meta, "reason") });
    } else if (a.action === "order.tracking") {
      const provider = metaText(a.meta, "provider");
      const no = metaText(a.meta, "trackingNo");
      entries.push({
        id,
        kind: "tracking_set",
        at: a.createdAt,
        actor,
        detail: provider && no ? `${provider} · ${no}` : (provider ?? no),
      });
    } else if (a.action === "order.address.update") {
      // Before/after addresses stay in the audit meta (super_admin only), never in the timeline.
      entries.push({ id, kind: "address_updated", at: a.createdAt, actor, detail: null });
    }
  }

  if (order.status === "cancelled" && !hasCancelAudit)
    entries.push({
      id: "cancelled",
      kind: "cancelled",
      at: order.updatedAt,
      actor: null,
      detail: order.cancelReason ?? null,
    });

  if (order.status === "expired")
    entries.push({
      id: "expired",
      kind: "expired",
      at: order.expiresAt ?? order.updatedAt,
      actor: null,
      detail: null,
    });

  for (const n of notes)
    entries.push({
      id: `note:${String(n._id)}`,
      kind: "note",
      at: n.createdAt,
      actor: actorOf(n.authorId),
      detail: n.text,
    });

  return entries.sort(
    (a, b) =>
      a.at.getTime() - b.at.getTime() ||
      RANK[a.kind] - RANK[b.kind] ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
