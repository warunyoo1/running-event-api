import {
  DEFAULT_EVENT_CATEGORY,
  DEFAULT_EVENT_THEME,
} from "../config/constants";
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

/**
 * `category` and `theme` are always emitted, even for a lean document that lacks them (spread after
 * `withId`: an existing key keeps its position, a missing one is appended).
 */
const defaultedFields = (e: EventLean) => ({
  category: e.category ?? DEFAULT_EVENT_CATEGORY,
  theme: e.theme ?? DEFAULT_EVENT_THEME,
});

/** Event fields + its active races + public images. */
export const toPublicEventView = (
  e: EventLean,
  races: readonly RaceLean[],
): PublicEventView => ({
  ...withId(e, ["images"]),
  ...defaultedFields(e),
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
  ...defaultedFields(e),
  orderCount,
  races: toRaceViews(races),
  images: toAdminImageViews(e),
});