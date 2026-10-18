import { EXPIRY_BATCH_SIZE, EXPIRY_INTERVAL_MS } from "../config/constants";
import { Order } from "../models";
import { transitionAndRelease } from "./order/order-quota";

/** Expires overdue `pending` orders and releases their quota. Slip-uploaded orders never auto-expire. */
export async function expireOverdue(now = new Date()): Promise<number> {
  const overdue = await Order.find({
    status: "pending",
    expiresAt: { $lt: now },
  })
    .select("_id")
    .limit(EXPIRY_BATCH_SIZE)
    .lean();
  let expired = 0;
  for (const o of overdue) {
    try {
      const done = await transitionAndRelease(
        { _id: o._id, status: "pending", expiresAt: { $lt: now } },
        "expired",
        {},
      );
      if (done) expired++;
    } catch (err) {
      // One broken order (e.g. a quota invariant violation) must not block the rest of the batch.
      console.error(`expiry failed for order ${String(o._id)}`, err);
    }
  }
  return expired;
}

let running = false;
export function startExpiryJob(
  intervalMs = EXPIRY_INTERVAL_MS,
): NodeJS.Timeout {
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
