import type { EventLean } from "../models/event.model";
import type { RaceLean } from "../models/race.model";
import { withId } from "../utils/lean";
import {
  toAdminImageViews,
  toPublicImageViews,
  type AdminEventImageView,
  type PublicEventImageView,
} from "./event-image.view";
import { toRaceViews, type RaceView } from "./race.view";

type EventFields = { id: string } & Omit<EventLean, "_id" | "images">;

export type PublicEventView = EventFields & {
  races: RaceView[];
  images: PublicEventImageView[];
};

export type AdminEventView = EventFields & {
  orderCount: number;
  races: RaceView[];
  images: AdminEventImageView[];
};

/** Event fields + its active races + public images. */
export const toPublicEventView = (
  e: EventLean,
  races: readonly RaceLean[],
): PublicEventView => ({
  ...withId(e, ["images"]),
  races: toRaceViews(races),
  images: toPublicImageViews(e),
});

/** Admin view: event fields + number of quota-holding orders + races + admin images. */
export const toAdminEventView = (
  e: EventLean,
  races: readonly RaceLean[],
  orderCount: number,
): AdminEventView => ({
  ...withId(e, ["images"]),
  orderCount,
  races: toRaceViews(races),
  images: toAdminImageViews(e),
});