import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { shippingSearchPipeline } from "../src/services/shipping.service";
import {
  exportShippingQuery,
  shippingQuery,
} from "../src/validators/admin.validator";

describe("shippingQuery.q", () => {
  it("trims the text", () => {
    expect(shippingQuery.parse({ q: "  สมชาย  " }).q).toBe("สมชาย");
  });
  it("turns empty or blank into undefined", () => {
    expect(shippingQuery.parse({ q: "" }).q).toBeUndefined();
    expect(shippingQuery.parse({ q: "   " }).q).toBeUndefined();
    expect(shippingQuery.parse({}).q).toBeUndefined();
  });
  it("rejects more than 200 characters", () => {
    expect(shippingQuery.safeParse({ q: "a".repeat(201) }).success).toBe(false);
    expect(shippingQuery.safeParse({ q: "a".repeat(200) }).success).toBe(true);
  });
  it("is kept by the export query", () => {
    expect(exportShippingQuery.parse({ q: " 1001 " }).q).toBe("1001");
  });
});

describe("shippingSearchPipeline", () => {
  const base = {
    status: "paid",
    eventId: new Types.ObjectId(),
    delivery: "shipping",
  } as const;

  it("has the exact stages in order", () => {
    const stages = shippingSearchPipeline("a.b(c)", base);
    expect(stages).toEqual([
      {
        $match: {
          $or: [
            {
              $expr: {
                $regexMatch: {
                  input: { $concat: ["$firstName", " ", "$lastName"] },
                  regex: "a\\.b\\(c\\)",
                  options: "i",
                },
              },
            },
            { bibNo: /a\.b\(c\)/i },
          ],
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          pipeline: [{ $match: base }, { $project: { _id: 1 } }],
          as: "o",
        },
      },
      { $match: { "o.0": { $exists: true } } },
      { $group: { _id: "$orderId" } },
    ]);
  });

  it("restricts the lookup to paid orders and keeps eventId an ObjectId", () => {
    const [, lookup] = shippingSearchPipeline("x", base);
    const inner = (lookup as unknown as { $lookup: { pipeline: { $match: typeof base }[] } })
      .$lookup.pipeline[0].$match;
    expect(inner.status).toBe("paid");
    expect(inner.eventId).toBeInstanceOf(Types.ObjectId);
  });
});
