import type { RaceLean } from "../models/race.model";

export interface RaceView {
  id: string;
  name: string;
  price: number;
  quota: number;
  unlimitedQuota?: boolean;
  reserved?: number;
  start: string | null;
  benefits?: string[];
  extraDetails?: string;
  remaining: number;
  prizes?: { rank: number; amount: number; trophy?: boolean }[];
}

/** Dashboard row: a race with its quota usage and the name of its event. */
export interface RaceStatView {
  raceId: string;
  eventId: string;
  eventName: string;
  name: string;
  price: number;
  quota: number;
  unlimitedQuota?: boolean;
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
  ...(r.unlimitedQuota ? { unlimitedQuota: true, reserved: r.reserved } : {}),
  start: r.start ?? null,
  ...(r.benefits?.length ? { benefits: [...r.benefits] } : {}),
  ...(r.extraDetails ? { extraDetails: r.extraDetails } : {}),
  remaining: remainingOf(r),
  ...(r.prizes?.length ? { prizes: [...r.prizes].sort((a, b) => a.rank - b.rank).map(({ rank, amount, trophy }) => ({ rank, amount, trophy: trophy ?? false })) } : {}),
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
  ...(r.unlimitedQuota ? { unlimitedQuota: true, reserved: r.reserved } : {}),
  reserved: r.reserved,
  remaining: remainingOf(r),
});
