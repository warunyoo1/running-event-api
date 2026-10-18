import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVENT_CATEGORY,
  DEFAULT_EVENT_THEME,
} from "../src/config/constants";
import {
  createFields,
  raceCreateFields,
  raceRestoreOps,
  raceUpdateOps,
  splitEventFields,
  toUpdate,
} from "../src/services/event/event-fields";
import type { EventBody } from "../src/validators/event.validator";

const body = (patch: Partial<EventBody> = {}): EventBody => ({
  name: "n",
  slug: "n",
  date: "2026-01-01",
  venue: "v",
  status: "draft",
  races: [{ name: "5K", price: 0, quota: 1 }],
  ...patch,
});

describe("splitEventFields", () => {
  it("leaves omitted keys out of both set and unset", () => {
    const { set, unset } = splitEventFields(body());
    expect(set).toEqual({ name: "n", slug: "n", date: "2026-01-01", venue: "v", status: "draft" });
    expect(unset).toEqual({});
    expect("races" in set).toBe(false);
    expect(Object.values(set)).not.toContain(undefined);
  });

  it("sets given values", () => {
    const { set, unset } = splitEventFields(
      body({ category: "trail", theme: "blue", registrationEnds: "2026-02-01" }),
    );
    expect(set).toMatchObject({ category: "trail", theme: "blue", registrationEnds: "2026-02-01" });
    expect(unset).toEqual({});
  });

  it("resets category and theme to the defaults on null", () => {
    const { set, unset } = splitEventFields(body({ category: null, theme: null }));
    expect(set).toMatchObject({ category: DEFAULT_EVENT_CATEGORY, theme: DEFAULT_EVENT_THEME });
    expect(unset).toEqual({});
  });

  it("unsets registrationEnds on null and never lists a key in both", () => {
    const { set, unset } = splitEventFields(body({ registrationEnds: null }));
    expect(unset).toEqual({ registrationEnds: "" });
    expect("registrationEnds" in set).toBe(false);
  });
});

describe("toUpdate", () => {
  it("adds $unset only when something is cleared", () => {
    expect(toUpdate({ set: { a: 1 }, unset: {} })).toEqual({ $set: { a: 1 } });
    expect(toUpdate({ set: { a: 1 }, unset: { b: "" } })).toEqual({
      $set: { a: 1 },
      $unset: { b: "" },
    });
  });
});

describe("createFields", () => {
  it("drops null and undefined", () => {
    const f = createFields(
      body({ category: null, theme: null, registrationEnds: null, subtitle: "s" }),
    );
    expect(f).toEqual({
      name: "n",
      slug: "n",
      date: "2026-01-01",
      venue: "v",
      status: "draft",
      subtitle: "s",
    });
  });
});

describe("raceCreateFields", () => {
  const eventId = new Types.ObjectId();
  const race = { name: "10K", price: 500, quota: 10 };

  it("omits start for null, undefined and empty string", () => {
    for (const start of [null, undefined, ""]) {
      const f = raceCreateFields({ ...race, start }, 2, eventId);
      expect("start" in f).toBe(false);
      expect(f).toEqual({ eventId, name: "10K", price: 500, quota: 10, sortOrder: 2 });
    }
  });

  it("keeps a given start", () => {
    expect(raceCreateFields({ ...race, start: "06:00" }, 0, eventId).start).toBe("06:00");
  });
});

describe("raceUpdateOps", () => {
  const race = { name: "10K", price: 500, quota: 10 };

  it("sets start when a string", () => {
    const { set, unset } = raceUpdateOps({ ...race, start: "06:00" }, 1);
    expect(set).toEqual({ name: "10K", price: 500, quota: 10, sortOrder: 1, active: true, start: "06:00" });
    expect(unset).toEqual({});
  });

  it("unsets start on null", () => {
    const { set, unset } = raceUpdateOps({ ...race, start: null }, 0);
    expect("start" in set).toBe(false);
    expect(unset).toEqual({ start: "" });
  });

  it("keeps start untouched when omitted", () => {
    const { set, unset } = raceUpdateOps(race, 0);
    expect("start" in set).toBe(false);
    expect(unset).toEqual({});
  });
});

describe("raceRestoreOps", () => {
  const before = { name: "10K", price: 500, quota: 10, sortOrder: 0, active: true };

  it("restores a previous start", () => {
    const { set, unset } = raceRestoreOps({ ...before, start: "05:30" });
    expect(set).toEqual({ ...before, start: "05:30" });
    expect(unset).toEqual({});
  });

  it("removes a start that did not exist before", () => {
    for (const start of [undefined, null]) {
      const { set, unset } = raceRestoreOps({ ...before, start });
      expect("start" in set).toBe(false);
      expect(unset).toEqual({ start: "" });
    }
  });
});
