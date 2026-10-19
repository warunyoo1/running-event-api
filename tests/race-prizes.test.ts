import { describe, expect, it } from "vitest";
import { eventBody } from "../src/validators/event.validator";
import { raceCreateFields, raceUpdateOps, raceRestoreOps } from "../src/services/event/event-fields";
import { toRaceView } from "../src/views/race.view";
import { races } from "./fixtures/view-fixtures";

const base = { name: "Event", slug: "event", date: "2030-01-01", venue: "Venue", status: "draft" };
const race = { name: "5 KM", price: 399, quota: 100 };
const parse = (prizes: unknown) => eventBody.safeParse({ ...base, races: [{ ...race, prizes }] });

describe("per-race prize schedule", () => {
  it("rejects duplicate ranks, invalid ranks and negative/fractional money", () => {
    for (const prizes of [[{ rank: 1, amount: 100 }, { rank: 1, amount: 200 }], [{ rank: 0, amount: 100 }], [{ rank: 1, amount: -1 }], [{ rank: 1, amount: 0.5 }]]) expect(parse(prizes).success).toBe(false);
    expect(parse([]).success).toBe(true);
    expect(parse(undefined).success).toBe(true);
    expect(parse([{ rank: 1, amount: 0 }]).success).toBe(true);
  });
  it("allows independent prize ranks across distances", () => {
    expect(eventBody.safeParse({ ...base, races: [{ ...race, prizes: [{ rank: 1, amount: 3000 }] }, { ...race, name: "10 KM", prizes: [{ rank: 1, amount: 5000 }] }] }).success).toBe(true);
  });
  it("stores, replaces, clears and preserves omitted schedules", () => {
    const prizes = [{ rank: 1, amount: 3000 }];
    expect(raceCreateFields({ ...race, prizes }, 0, "event")).toHaveProperty("prizes", prizes);
    expect(raceUpdateOps({ ...race, prizes }, 0).set).toHaveProperty("prizes", prizes);
    expect(raceUpdateOps({ ...race, prizes: [] }, 0).set).toHaveProperty("prizes", []);
    expect(raceUpdateOps(race, 0).set).not.toHaveProperty("prizes");
    expect(raceRestoreOps({ ...race, sortOrder: 0, active: true, prizes }).set).toHaveProperty("prizes", prizes);
    expect(raceRestoreOps({ ...race, sortOrder: 0, active: true }).unset).toHaveProperty("prizes", "");
  });
  it("returns prizes in rank order without changing stored order or legacy views", () => {
    const prizes = [{ rank: 3, amount: 1000 }, { rank: 1, amount: 3000 }];
    expect(toRaceView({ ...races[0], prizes }).prizes).toEqual([prizes[1], prizes[0]].map((prize) => ({ ...prize, trophy: false })));
    expect(prizes[0].rank).toBe(3);
    expect(toRaceView(races[0])).not.toHaveProperty("prizes");
  });
  it("validates and preserves the trophy choice for each prize", () => {
    expect(parse([{ rank: 1, amount: 0, trophy: "yes" }]).success).toBe(false);
    for (const trophy of [true, false]) {
      const prizes = [{ rank: 1, amount: 0, trophy }];
      expect(parse(prizes).success).toBe(true);
      expect(raceCreateFields({ ...race, prizes }, 0, "event")).toHaveProperty("prizes", prizes);
      expect(raceUpdateOps({ ...race, prizes }, 0).set).toHaveProperty("prizes", prizes);
      expect(raceRestoreOps({ ...race, sortOrder: 0, active: true, prizes }).set).toHaveProperty("prizes", prizes);
      expect(toRaceView({ ...races[0], prizes }).prizes?.[0].trophy).toBe(trophy);
    }
  });
});
