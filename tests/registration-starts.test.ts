import { afterEach, describe, expect, it, vi } from "vitest";
import { eventBody } from "../src/validators/event.validator";
import { createFields, splitEventFields } from "../src/services/event/event-fields";
import { EventModel, Race } from "../src/models";
import { createOrder } from "../src/services/order/order-create.service";
import type { CreateOrderInput } from "../src/validators/order.validator";
import { update } from "../src/services/event/event-write.service";
import { toPublicEventView, toAdminEventView } from "../src/views/event.view";
import { event, races } from "./fixtures/view-fixtures";

const base = { name: "Event", slug: "event", date: "2030-12-31", venue: "Venue", status: "open", races: [{ name: "5 KM", price: 399, quota: 100 }] };
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("registration start date contract", () => {
  it("validates real dates, ordering, and accepts same-day opening", () => {
    for (const patch of [{ registrationStarts: "2030-02-30" }, { registrationStarts: "2031-01-01" }, { registrationStarts: "2030-12-02", registrationEnds: "2030-12-01" }]) expect(eventBody.safeParse({ ...base, ...patch }).success).toBe(false);
    expect(eventBody.safeParse({ ...base, registrationStarts: base.date, registrationEnds: base.date }).success).toBe(true);
  });
  it("preserves omitted dates, stores dates, and clears with null", () => {
    const omitted = eventBody.parse(base);
    expect(splitEventFields(omitted).set).not.toHaveProperty("registrationStarts");
    const dated = eventBody.parse({ ...base, registrationStarts: "2030-01-01" });
    expect(createFields(dated)).toHaveProperty("registrationStarts", "2030-01-01");
    const cleared = eventBody.parse({ ...base, registrationStarts: null });
    expect(splitEventFields(cleared).unset).toHaveProperty("registrationStarts", "");
    expect(createFields(cleared)).not.toHaveProperty("registrationStarts");
  });
  it("includes stored opening date in both public and admin views", () => {
    const dated = { ...event, registrationStarts: "2026-01-01" };
    expect(toPublicEventView(dated, races).registrationStarts).toBe("2026-01-01");
    expect(toAdminEventView(dated, races, 0).registrationStarts).toBe("2026-01-01");
  });
  it("rejects inconsistent updates when opening date is omitted but stored", async () => {
    vi.spyOn(EventModel, "findOne").mockResolvedValue({ registrationStarts: "2030-12-15" } as never);
    await expect(update("actor", "id", eventBody.parse({ ...base, registrationEnds: "2030-12-01" }))).rejects.toMatchObject({ code: "VALIDATION_ERROR", fields: { registrationEnds: expect.any(String) } });
  });
  it("blocks future opening before quota lookup; today and old events pass the guard", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-18T17:00:00Z")); // midnight Bangkok
    const find = vi.spyOn(EventModel, "findOne");
    const raceFind = vi.spyOn(Race, "find").mockImplementation(() => { throw new Error("past-opening-guard"); });
    find.mockResolvedValue({ status: "open", registrationStarts: "2026-10-20" } as never);
    await expect(createOrder("event", {} as CreateOrderInput)).rejects.toMatchObject({ code: "REGISTRATION_NOT_OPEN" });
    expect(raceFind).not.toHaveBeenCalled();
    for (const registrationStarts of ["2026-10-19", undefined]) {
      find.mockResolvedValue({ status: "open", registrationStarts } as never);
      await expect(createOrder("event", {} as CreateOrderInput)).rejects.toThrow("past-opening-guard");
    }
  });
});
