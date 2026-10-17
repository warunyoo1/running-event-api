import { randomInt } from "node:crypto";

/** e.g. RR2701-48213 */
export function generateOrderNo(now = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `RR${yy}${mm}-${randomInt(10000, 100000)}`;
}
