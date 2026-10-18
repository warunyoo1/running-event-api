import type { RaceLean } from "../models/race.model";

export interface RaceView {
  id: string;
  name: string;
  price: number;
  quota: number;
  start: string | null;
  remaining: number;
}

/** Dashboard row: a race with its quota usage and the name of its event. */
export interface RaceStatView {
  raceId: string;
  eventId: string;
  eventName: string;
  name: string;
  price: number;
  quota: number;
  reserved: number;
  remaining: number;
}

const remainingOf = (r: Pick<RaceLean, "quota" | "reserved">): number =>
  Math.max(0, r.quota - r.reserved);

export const toRaceView = (r: RaceLean): RaceView => ({
  id: String(r._id),
  name: r.name,
  price: r.price,
  quota: r.quota,
  start: r.start ?? null,
  remaining: remainingOf(r),
});

export const toRaceViews = (races: readonly RaceLean[]): RaceView[] =>
  races.map((r) => toRaceView(r));

export const toRaceStatView = (
  r: RaceLean,
  eventName: string,
): RaceStatView => ({
  raceId: String(r._id),
  eventId: String(r.eventId),
  eventName,
  name: r.name,
  price: r.price,
  quota: r.quota,
  reserved: r.reserved,
  remaining: remainingOf(r),
});