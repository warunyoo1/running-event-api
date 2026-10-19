import { afterEach, describe, expect, it, vi } from "vitest";
import { Race } from "../src/models";
import { releaseQuota, reserveQuota } from "../src/services/order/order-quota";

afterEach(() => vi.restoreAllMocks());
describe("capacity reservation", () => {
  it("allows an unlimited branch while retaining active and finite-capacity guards in the atomic write", async () => {
    const reserve = vi.spyOn(Race, "findOneAndUpdate").mockResolvedValue({ _id: "race", reserved: 501 } as never);
    await reserveQuota(new Map([["race", 2]]), new Map([["race", "5K"]]));
    expect(reserve).toHaveBeenCalledWith({ _id: "race", active: true, $or: [{ unlimitedQuota: true }, { $expr: { $lte: [{ $add: ["$reserved", 2] }, "$quota"] } }] }, { $inc: { reserved: 2 } }, { new: true });
    const release = vi.spyOn(Race, "updateOne").mockResolvedValue({ matchedCount: 1 } as never);
    await releaseQuota([{ raceId: "race", count: 2 }]);
    expect(release).toHaveBeenCalledWith({ _id: "race", reserved: { $gte: 2 } }, { $inc: { reserved: -2 } });
  });
});
