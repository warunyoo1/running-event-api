import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVENT_CATEGORY,
  DEFAULT_EVENT_THEME,
} from "../../src/config/constants";
import type { EventLean } from "../../src/models/event.model";
import { toAdminEventView, toPublicEventView } from "../../src/views/event.view";
import { event, races } from "../fixtures/view-fixtures";

const { category: _c, theme: _t, ...rest } = event;
const withoutDefaults = rest as unknown as EventLean;

describe("event views always emit category and theme", () => {
  it("public view falls back to the defaults for a lean event without them", () => {
    const v = toPublicEventView(withoutDefaults, races);
    expect(v.category).toBe(DEFAULT_EVENT_CATEGORY);
    expect(v.theme).toBe(DEFAULT_EVENT_THEME);
    expect(Object.keys(v)).toEqual(expect.arrayContaining(["category", "theme"]));
  });

  it("admin view falls back to the defaults for a lean event without them", () => {
    const v = toAdminEventView(withoutDefaults, races, 3);
    expect(v.category).toBe(DEFAULT_EVENT_CATEGORY);
    expect(v.theme).toBe(DEFAULT_EVENT_THEME);
    expect(v.orderCount).toBe(3);
  });

  it("passes explicit values through", () => {
    const custom = { ...event, category: "trail", theme: "blue" } as unknown as EventLean;
    expect(toPublicEventView(custom, races)).toMatchObject({ category: "trail", theme: "blue" });
    expect(toAdminEventView(custom, races, 0)).toMatchObject({ category: "trail", theme: "blue" });
  });

  it("keeps the key order of a complete event", () => {
    const keys = Object.keys(toPublicEventView(event, races));
    expect(keys.indexOf("province")).toBeLessThan(keys.indexOf("category"));
    expect(keys.indexOf("category")).toBeLessThan(keys.indexOf("theme"));
    expect(keys.indexOf("theme")).toBeLessThan(keys.indexOf("status"));
  });
});
