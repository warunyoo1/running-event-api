import { describe, expect, it } from "vitest";
import { eventBody } from "../src/validators/event.validator";
import { raceCreateFields, raceUpdateOps, raceRestoreOps } from "../src/services/event/event-fields";
import { toRaceView } from "../src/views/race.view";
import { races } from "./fixtures/view-fixtures";
const base = { name: "Event", slug: "event", date: "2030-01-01", venue: "Venue", status: "draft" };
const race = { name: "5 KM", price: 399, quota: 100 };
describe("per-race benefits", () => {
  it("accepts optional and empty values while rejecting duplicates and excessive data", () => {
    const parse = (patch: object) => eventBody.safeParse({ ...base, races: [{ ...race, ...patch }] });
    for (const patch of [{}, { benefits: [], extraDetails: "" }, { benefits: ["เสื้อ", "BIB", "เหรียญ"], extraDetails: "รับเหรียญเมื่อเข้าเส้นชัย" }]) expect(parse(patch).success).toBe(true);
    for (const patch of [{ benefits: [""] }, { benefits: ["เสื้อ", " เสื้อ "] }, { benefits: Array(21).fill("BIB") }, { extraDetails: "x".repeat(2001) }]) expect(parse(patch).success).toBe(false);
  });
  it("round-trips benefits and details and preserves/clears fields intentionally", () => {
    const data = { benefits: ["เสื้อ", "BIB"], extraDetails: "เงื่อนไขเพิ่มเติม" };
    expect(raceCreateFields({ ...race, ...data }, 0, "event")).toMatchObject(data);
    expect(raceUpdateOps({ ...race, ...data }, 0).set).toMatchObject(data);
    expect(raceUpdateOps({ ...race, benefits: [], extraDetails: "" }, 0).set).toMatchObject({ benefits: [], extraDetails: "" });
    expect(raceUpdateOps(race, 0).set).not.toHaveProperty("benefits");
    expect(raceRestoreOps({ ...race, ...data, active: true, sortOrder: 0 }).set).toMatchObject(data);
    expect(toRaceView({ ...races[0], ...data })).toMatchObject(data);
    expect(toRaceView(races[0])).not.toHaveProperty("benefits");
  });
});
