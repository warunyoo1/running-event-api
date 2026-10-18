import { API_PREFIX, type EventImageKind } from "../config/constants";
import type { EventImageLean } from "../models/event.model";

export interface PublicEventImageView {
  id: string;
  kind: EventImageKind;
  alt: string;
  url: string;
  sortOrder: number;
}

export interface AdminEventImageView extends PublicEventImageView {
  previewUrl: string;
  mime: string;
  size: number;
  createdAt: string | null;
}

/** Anything that carries an `images` array (old documents may lack it). */
interface WithImages {
  images?: readonly EventImageLean[] | null;
}

const sortImages = (
  images: readonly EventImageLean[] | null | undefined,
): EventImageLean[] =>
  [...(images ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

const publicUrl = (imageId: string): string =>
  `${API_PREFIX}/public/event-images/${imageId}`;
const previewUrl = (eventId: string, imageId: string): string =>
  `${API_PREFIX}/admin/events/${eventId}/images/${imageId}/file`;

/** Public view: no filename, mime or size. Sorted by `sortOrder` (stable). */
export function toPublicImageViews(e: WithImages): PublicEventImageView[] {
  return sortImages(e.images).map((i) => ({
    id: String(i._id),
    kind: i.kind,
    alt: i.alt ?? "",
    url: publicUrl(String(i._id)),
    sortOrder: i.sortOrder ?? 0,
  }));
}

/** Admin view: public view + preview URL (works for drafts), mime, size and createdAt. */
export function toAdminImageViews(
  e: WithImages & { _id: unknown },
): AdminEventImageView[] {
  const eventId = String(e._id);
  return sortImages(e.images).map((i) => ({
    id: String(i._id),
    kind: i.kind,
    alt: i.alt ?? "",
    url: publicUrl(String(i._id)),
    sortOrder: i.sortOrder ?? 0,
    previewUrl: previewUrl(eventId, String(i._id)),
    mime: i.mime,
    size: i.size,
    createdAt: i.createdAt ? i.createdAt.toISOString() : null,
  }));
}