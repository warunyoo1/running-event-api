import type { ClientSession, FilterQuery, Types } from "mongoose";
import { Order, Race } from "../../models";
import type { OrderDoc } from "../../models/order.model";
import { ApiError, type FieldErrors } from "../../utils/api-error";

/** Number of participants per race id. */
export type RaceCounts = Map<string, number>;

/**
 * Reserves quota for every race in `counts` inside the caller's transaction.
 * Throws QUOTA_FULL (fields keyed by race name) when any race lacks room, which rolls the transaction back.
 */
export async function reserveQuota(
  counts: RaceCounts,
  raceNameById: ReadonlyMap<string, string>,
  session: ClientSession,
): Promise<void> {
  const full: FieldErrors = {};
  // Reserve in sorted race-id order to keep lock ordering consistent between concurrent orders.
  const sorted = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [raceId, n] of sorted) {
    const reserved = await Race.findOneAndUpdate(
      {
        _id: raceId,
        active: true,
        $expr: { $lte: [{ $add: ["$reserved", n] }, "$quota"] },
      },
      { $inc: { reserved: n } },
      { session, new: true },
    );
    if (!reserved) full[raceNameById.get(raceId)!] = "โควตาเต็มหรือเหลือไม่พอ";
  }
  if (Object.keys(full).length)
    throw ApiError.conflict(
      "QUOTA_FULL",
      "โควตาของระยะที่เลือกเต็มหรือเหลือไม่พอ",
      full,
    );
}

type RaceCount = { raceId?: Types.ObjectId | null; count?: number | null };

/** Gives reserved seats back. Throws (rolling back the transaction) instead of letting `reserved` go negative. */
async function releaseQuota(
  raceCounts: readonly RaceCount[],
  session: ClientSession,
): Promise<void> {
  for (const { raceId, count } of raceCounts) {
    const n = count ?? 0;
    const res = await Race.updateOne(
      { _id: raceId, reserved: { $gte: n } },
      { $inc: { reserved: -n } },
      { session },
    );
    if (res.matchedCount === 0)
      throw new Error(
        `quota release would make reserved negative for race ${String(raceId)}`,
      );
  }
}

/**
 * Atomic conditional transition + quota release (cancel / expire), exactly once per order.
 * Returns false if the order no longer matches `filter` or its quota was already released.
 */
export async function transitionAndRelease(
  filter: FilterQuery<OrderDoc>,
  to: "cancelled" | "expired",
  set: Record<string, unknown>,
  session: ClientSession,
): Promise<boolean> {
  const order = await Order.findOneAndUpdate(
    // Old documents lack quotaReleased, hence $ne rather than false.
    { ...filter, quotaReleased: { $ne: true } },
    { $set: { status: to, ...set, quotaReleased: true } },
    { session, new: false },
  );
  if (!order) return false;
  await releaseQuota(order.raceCounts, session);
  return true;
}
