import { ORDER_NOTES_MAX_PER_ORDER } from "../../config/constants";
import { AuditLog, OrderNote, User } from "../../models";
import type { OrderLean } from "../../models/order.model";
import type { PaymentLean } from "../../models/payment.model";
import { toOrderNoteView } from "../../views/order-note.view";
import {
  TIMELINE_AUDIT_ACTIONS,
  toOrderTimelineView,
} from "../../views/order-timeline.view";
import type { AdminOrderDetailExtras } from "../../views/order.view";
import { canEditAddress } from "./order-state";

/** Newest audit rows kept for the timeline (the view sorts them ascending). */
const TIMELINE_AUDIT_LIMIT = 200;

/**
 * Loads what the admin order detail adds on top of the base order: notes, timeline, reviewer name.
 * A failing query fails the whole request (no half-built timeline).
 */
export async function loadDetailExtras(
  order: OrderLean,
  payments: readonly PaymentLean[],
): Promise<AdminOrderDetailExtras> {
  const [notes, audit] = await Promise.all([
    OrderNote.find({ orderId: order._id })
      .sort({ createdAt: 1 })
      .limit(ORDER_NOTES_MAX_PER_ORDER)
      .lean(),
    AuditLog.find({
      entity: "Order",
      entityId: String(order._id),
      action: { $in: [...TIMELINE_AUDIT_ACTIONS] },
    })
      .sort({ createdAt: -1 })
      .limit(TIMELINE_AUDIT_LIMIT)
      .lean(),
  ]);

  const userIds = new Set<string>();
  const addUser = (id: unknown) => {
    if (id !== null && id !== undefined) userIds.add(String(id));
  };
  addUser(order.reviewedBy);
  payments.forEach((p) => addUser(p.reviewedBy));
  notes.forEach((n) => addUser(n.authorId));
  audit.forEach((a) => addUser(a.userId));

  const users = await User.find({ _id: { $in: [...userIds] } })
    .select("name")
    .lean();
  const names = new Map(users.map((u) => [String(u._id), u.name]));

  return {
    reviewedByName: order.reviewedBy
      ? (names.get(String(order.reviewedBy)) ?? null)
      : null,
    canEditAddress: canEditAddress(order),
    notes: notes.map((n) => toOrderNoteView(n, names)),
    timeline: toOrderTimelineView({ order, payments, notes, audit, names }),
  };
}
