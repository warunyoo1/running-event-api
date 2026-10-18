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
