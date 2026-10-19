import type { FilterQuery, Types } from "mongoose";
import { Order, Race } from "../../models";
import type { OrderDoc } from "../../models/order.model";
import { ApiError, type FieldErrors } from "../../utils/api-error";

/** Number of participants per race id. */
export type RaceCounts = Map<string, number>;

type RaceCount = { raceId?: Types.ObjectId | string | null; count?: number | null };

/**
 * Gives reserved seats back. The `reserved >= n` filter keeps `reserved` from going negative;
 * a miss is logged (never thrown) so callers, including compensation paths, are not derailed.
 */
export async function releaseQuota(
  raceCounts: readonly RaceCount[],
): Promise<void> {
  for (const { raceId, count } of raceCounts) {
    const n = count ?? 0;
    const res = await Race.updateOne(
      { _id: raceId, reserved: { $gte: n } },
      { $inc: { reserved: -n } },
    );
    if (res.matchedCount === 0)
      console.error(
        `quota release skipped: reserved would go negative for race ${String(raceId)}`,
      );
  }
}

/**
 * Reserves quota for every race in `counts`, no transaction. Each race is one atomic conditional
 * update (`reserved + n <= quota`). If any race is full, the races already reserved are released
 * again and QUOTA_FULL is thrown (fields keyed by race name).
 */
export async function reserveQuota(
  counts: RaceCounts,
  raceNameById: ReadonlyMap<string, string>,
): Promise<void> {
  const full: FieldErrors = {};
  const done: RaceCount[] = [];
  try {
    for (const [raceId, n] of counts) {
      const reserved = await Race.findOneAndUpdate(
        {
          _id: raceId,
          active: true,
          $or: [{ unlimitedQuota: true }, { $expr: { $lte: [{ $add: ["$reserved", n] }, "$quota"] } }],
        },
        { $inc: { reserved: n } },
        { new: true },
      );
      if (reserved) done.push({ raceId: reserved._id, count: n });
      else full[raceNameById.get(raceId)!] = "โควตาเต็มหรือเหลือไม่พอ";
    }
  } catch (err) {
    await releaseQuota(done).catch((e) => console.error("quota rollback failed", e));
    throw err;
  }
  if (Object.keys(full).length) {
    await releaseQuota(done).catch((e) => console.error("quota rollback failed", e));
    throw ApiError.conflict(
      "QUOTA_FULL",
      "โควตาของระยะที่เลือกเต็มหรือเหลือไม่พอ",
      full,
    );
  }
}

/**
 * Conditional status transition + quota release (cancel / expire), exactly once per order:
 * `quotaReleased` is flipped in the same single-document update as the status, so only one caller
 * wins. Returns false if the order no longer matches `filter` or its quota was already released.
 * Trade-off: a crash between the flip and the release leaves that quota unreleased.
 */
export async function transitionAndRelease(
  filter: FilterQuery<OrderDoc>,
  to: "cancelled" | "expired",
  set: Record<string, unknown>,
): Promise<boolean> {
  const order = await Order.findOneAndUpdate(
    // Old documents lack quotaReleased, hence $ne rather than false.
    { ...filter, quotaReleased: { $ne: true } },
    { $set: { status: to, ...set, quotaReleased: true } },
    { new: false },
  );
  if (!order) return false;
  await releaseQuota(order.raceCounts);
  return true;
}
