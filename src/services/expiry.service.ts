import { Order } from "../models";
import { withTransaction } from "../utils/transaction";
import { transitionAndRelease } from "./order.service";

/** Expires overdue `pending` orders and releases their quota. Slip-uploaded orders never auto-expire. */
export async function expireOverdue(now = new Date()): Promise<number> {
  const overdue = await Order.find({
    status: "pending",
    expiresAt: { $lt: now },
  })
    .select("_id")
    .limit(500)
    .lean();
  let expired = 0;
  for (const o of overdue) {
    const done = await withTransaction((session) =>
      transitionAndRelease(
        { _id: o._id, status: "pending", expiresAt: { $lt: now } },
        "expired",
        {},
        session,
      ),
    );
    if (done) expired++;
  }
  return expired;
}

let running = false;
export function startExpiryJob(intervalMs = 60_000) {
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const n = await expireOverdue();
      if (n) console.log(`expired ${n} overdue order(s)`);
    } catch (err) {
      console.error("expiry job failed", err);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return timer;
}
