import type { Types } from "mongoose";
import {
  DEFAULT_EVENT_CATEGORY,
  DEFAULT_EVENT_THEME,
} from "../../config/constants";
import type { EventBody } from "../../validators/event.validator";

// Pure builders for the Mongo writes of an event form. They are the ONLY way event and race fields
// reach Mongo, so `undefined` (keep the stored value) and `null` (clear) never leak into a document.

type RaceInput = EventBody["races"][number];

/** `$set` / `$unset` parts of one update; a key is never in both. */
export type FieldOps = {
  set: Record<string, unknown>;
  unset: Record<string, "">;
};

/** Mongo update document for the given ops (`$unset` only when something is cleared). */
export const toUpdate = ({ set, unset }: FieldOps) => ({
  $set: set,
  ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
});

/**
 * Event fields of an update (races excluded).
 * - `undefined`: skipped, the stored value stays.
 * - `category` / `theme` `null`: reset to the default (the key stays on the document).
 * - `registrationEnds` `null`: unset.
 */
export function splitEventFields(body: EventBody): FieldOps {
  const { races: _races, ...fields } = body;
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (value !== null) set[key] = value;
    else if (key === "category") set.category = DEFAULT_EVENT_CATEGORY;
    else if (key === "theme") set.theme = DEFAULT_EVENT_THEME;
    else unset[key] = "";
  }
  return { set, unset };
}

/** Event fields of a create: `set` only, `null` behaves like omitted. */
export function createFields(body: EventBody): Record<string, unknown> {
  const { races: _races, ...fields } = body;
  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined && v !== null),
  );
}

/** A new race document. `start` is written only when it is a non-empty string. */
export function raceCreateFields(
  r: RaceInput,
  index: number,
  eventId: Types.ObjectId | string,
) {
  return {
    eventId,
    name: r.name,
    price: r.price,
    quota: r.quota,
    sortOrder: index,
    ...(r.start ? { start: r.start } : {}),
  };
}

/** Update ops of an existing race (re-activates it): `start` string sets, `null` unsets, `undefined` keeps. */
export function raceUpdateOps(r: RaceInput, index: number): FieldOps {
  const set: Record<string, unknown> = {
    name: r.name,
    price: r.price,
    quota: r.quota,
    sortOrder: index,
    active: true,
  };
  const unset: Record<string, ""> = {};
  if (typeof r.start === "string") set.start = r.start;
  else if (r.start === null) unset.start = "";
  return { set, unset };
}

export type RaceSnapshot = {
  name: string;
  price: number;
  quota: number;
  start?: string | null;
  sortOrder: number;
  active: boolean;
};

/** Inverse of `raceUpdateOps`: restores the snapshot, removing a start that did not exist before. */
export function raceRestoreOps(before: RaceSnapshot): FieldOps {
  const { start, ...rest } = before;
  const set: Record<string, unknown> = { ...rest };
  const unset: Record<string, ""> = {};
  if (typeof start === "string") set.start = start;
  else unset.start = "";
  return { set, unset };
}
