import { describe, expect, it } from "vitest";
import * as F from "../fixtures/view-fixtures";
import { toRaceStatView, toRaceView, toRaceViews } from "../../src/views/race.view";

describe("toRaceView", () => {
  it("exposes unlimited capacity and actual bookings even beyond the stored quota", () => {
    expect(toRaceView({ ...F.races[0], quota: 1, reserved: 500, unlimitedQuota: true })).toMatchObject({ unlimitedQuota: true, reserved: 500 });
  });
  it("keeps the documented key order and shapes price/quota/start", () => {
    const v = toRaceView(F.races[0]);
    expect(Object.keys(v)).toEqual(["id", "name", "price", "quota", "start", "remaining"]);
    expect(v).toMatchObject({ price: 500, quota: 100, start: "05:30", remaining: 60 });
  });

  it("clamps remaining at 0 when oversold and turns a missing start into null", () => {
    const v = toRaceView(F.races[1]);
    expect(v.remaining).toBe(0);
    expect(v.start).toBeNull();
  });

  it("maps a list in order", () => {
    expect(toRaceViews(F.races).map((r) => r.name)).toEqual(["10K", "5K"]);
  });
});

describe("toRaceStatView", () => {
  it("adds the event name and reserved count", () => {
    const v = toRaceStatView(F.races[0], "Bangkok Run");
    expect(Object.keys(v)).toEqual([
      "raceId", "eventId", "eventName", "name", "price", "quota", "reserved", "remaining",
    ]);
    expect(v).toMatchObject({ eventName: "Bangkok Run", reserved: 40, remaining: 60 });
  });
});