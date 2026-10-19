import { describe, expect, it } from "vitest";
import {
  adminEventsQuery,
  eventBody,
} from "../src/validators/event.validator";

const valid = {
  name: "n",
  slug: "n",
  date: "2026-01-01",
  venue: "v",
  status: "draft",
  races: [{ name: "5K", price: 0, quota: 1 }],
};

const parse = (patch: Record<string, unknown>) =>
  eventBody.safeParse({ ...valid, ...patch });

describe("eventBody null clears", () => {
  it("accepts unlimited quota and keeps the flag optional for older callers", () => {
    expect(parse({}).data?.races[0].unlimitedQuota).toBeUndefined();
    expect(parse({ races: [{ name: "5K", price: 0, quota: 1, unlimitedQuota: true }] }).data?.races[0].unlimitedQuota).toBe(true);
    expect(parse({ races: [{ name: "5K", price: 0, quota: 100, unlimitedQuota: "yes" }] }).success).toBe(false);
  });
  it("accepts optional web links and rejects unsafe or malformed protocols", () => {
    for (const key of ["websiteUrl", "locationUrl", "shirtPickupUrl"]) {
      expect(parse({ [key]: "" }).success).toBe(true);
      expect(parse({ [key]: " https://example.com/details?q=1 " }).data?.[key as "websiteUrl"]).toBe("https://example.com/details?q=1");
      for (const value of ["invalid", "javascript:alert(1)", "data:text/html,test", "ftp://example.com", "//example.com"]) expect(parse({ [key]: value }).success).toBe(false);
    }
  });
  it("accepts optional organizer phone lists, normalizes formatting, and rejects duplicates", () => {
    expect(parse({}).data?.contactPhones).toBeUndefined();
    expect(parse({ contactPhones: [] }).data?.contactPhones).toEqual([]);
    expect(parse({ contactPhones: ["081-234-5678", "+66 (89) 123 4567"] }).data?.contactPhones).toEqual(["0812345678", "+66891234567"]);
    for (const contactPhones of [["0812345678", "081-234-5678"], ["abc"], ["123"], ["1".repeat(16)], Array(11).fill("0812345678")]) expect(parse({ contactPhones }).success).toBe(false);
  });
  it("accepts optional start point, trims it, and permits clearing", () => {
    expect(parse({}).data?.startPoint).toBeUndefined();
    expect(parse({ startPoint: "  Main gate  " }).data?.startPoint).toBe("Main gate");
    expect(parse({ startPoint: "" }).data?.startPoint).toBe("");
    expect(parse({ startPoint: "x".repeat(301) }).success).toBe(false);
  });
  it("accepts optional shirt pickup point, trims it, and permits clearing", () => {
    expect(parse({}).data?.shirtPickupPoint).toBeUndefined();
    expect(parse({ shirtPickupPoint: "  Main gate  " }).data?.shirtPickupPoint).toBe("Main gate");
    expect(parse({ shirtPickupPoint: "" }).data?.shirtPickupPoint).toBe("");
    expect(parse({ shirtPickupPoint: "x".repeat(301) }).success).toBe(false);
  });
  it("accepts null for category, theme and registrationEnds", () => {
    for (const key of ["category", "theme", "registrationEnds"]) {
      const r = parse({ [key]: null });
      expect(r.success).toBe(true);
      expect(r.data).toHaveProperty(key, null);
    }
  });

  it("accepts null for a race start", () => {
    const r = parse({ races: [{ name: "5K", price: 0, quota: 1, start: null }] });
    expect(r.success).toBe(true);
    expect(r.data?.races[0].start).toBeNull();
  });

  it("keeps omitted keys undefined", () => {
    const r = parse({});
    expect(r.data?.category).toBeUndefined();
    expect(r.data?.registrationEnds).toBeUndefined();
    expect(r.data?.races[0].start).toBeUndefined();
  });

  it("still validates non-null values", () => {
    expect(parse({ category: "swim" }).success).toBe(false);
    expect(parse({ registrationEnds: "2026-13-01" }).success).toBe(false);
    expect(
      parse({ races: [{ name: "5K", price: 0, quota: 1, start: "25:00" }] }).success,
    ).toBe(false);
  });

  it("rejects null for name, slug, date, venue, status, races and subtitle", () => {
    for (const key of ["name", "slug", "date", "venue", "status", "races", "subtitle"])
      expect(parse({ [key]: null }).success, key).toBe(false);
  });
});

describe("adminEventsQuery archived", () => {
  const archived = (v: unknown) =>
    adminEventsQuery.safeParse(v === undefined ? {} : { archived: v });

  it("defaults to false when missing or empty", () => {
    expect(archived(undefined).data?.archived).toBe(false);
    expect(archived("").data?.archived).toBe(false);
  });
  it("transforms 'true' and 'false' to booleans", () => {
    expect(archived("true").data?.archived).toBe(true);
    expect(archived("false").data?.archived).toBe(false);
  });
  it("rejects other values", () => {
    expect(archived("x").success).toBe(false);
    expect(archived("1").success).toBe(false);
  });
});
