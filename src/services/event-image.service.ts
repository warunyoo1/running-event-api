import { Types } from "mongoose";
import {
  EVENT_IMAGE_MAX_PER_EVENT,
  HTTP_STATUS,
  PUBLIC_EVENT_STATUSES,
} from "../config/constants";
import { EventModel } from "../models";
import type { EventImageLean } from "../models/event.model";
import { ApiError } from "../utils/api-error";
import {
  deleteEventImage,
  detectImage,
  resolveEventImagePath,
  saveEventImage,
} from "../utils/slip-file";
import type {
  PatchImageBody,
  UploadImagesBody,
} from "../validators/event.validator";
import {
  toAdminImageViews,
  type AdminEventImageView,
} from "../views/event-image.view";
import { audit } from "./audit.service";
import { eventNotFound } from "./service-errors";

const imageNotFound = () =>
  ApiError.notFound("ไม่พบรูปภาพ", "IMAGE_NOT_FOUND");
const limitReached = () =>
  new ApiError(
    HTTP_STATUS.UNPROCESSABLE_ENTITY,
    "IMAGE_LIMIT_REACHED",
    `งานวิ่งหนึ่งงานมีรูปได้ไม่เกิน ${EVENT_IMAGE_MAX_PER_EVENT} รูป`,
  );

// --- admin operations --------------------------------------------------

export async function listImages(
  eventId: string,
): Promise<AdminEventImageView[]> {
  const e = await EventModel.findOne(
    { _id: eventId, archived: false },
    { images: 1 },
  ).lean();
  if (!e) throw eventNotFound();
  return toAdminImageViews(e);
}

export async function addImages(
  actorId: string,
  eventId: string,
  files: Express.Multer.File[],
  body: UploadImagesBody,
): Promise<AdminEventImageView[]> {
  if (files.length === 0)
    throw ApiError.validation({ files: "กรุณาแนบรูปภาพ" });
  const event = await EventModel.findOne(
    { _id: eventId, archived: false },
    { "images.sortOrder": 1 },
  ).lean();
  if (!event) throw eventNotFound();

  // Verify every file by magic bytes before anything is written.
  const detected = files.map((f, i) => {
    const d = detectImage(f.buffer);
    if (!d)
      throw new ApiError(
        HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
        "UNSUPPORTED_FILE_TYPE",
        `ไฟล์ที่ ${i + 1}: รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP`,
      );
    return d;
  });

  const existing = event.images ?? [];
  if (existing.length + files.length > EVENT_IMAGE_MAX_PER_EVENT)
    throw limitReached();
  const base = existing.length
    ? Math.max(...existing.map((i) => i.sortOrder ?? 0)) + 1
    : 0;

  const written: string[] = [];
  const cleanup = () =>
    Promise.all(written.map((name) => deleteEventImage(eventId, name)));
  const now = new Date();
  const docs: EventImageLean[] = [];
  try {
    for (const [i, file] of files.entries()) {
      const filename = await saveEventImage(eventId, file.buffer, detected[i].ext);
      written.push(filename);
      docs.push({
        _id: new Types.ObjectId(),
        kind: body.kind,
        filename,
        mime: detected[i].mime,
        size: file.size,
        alt: body.alt ?? "",
        sortOrder: base + i,
        createdAt: now,
      });
    }
    // Atomic cap: a concurrent upload that filled the event makes this match nothing.
    const res = await EventModel.updateOne(
      {
        _id: eventId,
        archived: false,
        $expr: {
          $lte: [
            { $size: { $ifNull: ["$images", []] } },
            EVENT_IMAGE_MAX_PER_EVENT - files.length,
          ],
        },
      },
      { $push: { images: { $each: docs } } },
    );
    if (res.matchedCount === 0) {
      await cleanup();
      throw limitReached();
    }
  } catch (err) {
    await cleanup();
    throw err;
  }
  await audit(actorId, "event.image.add", "Event", eventId, {
    count: docs.length,
    kind: body.kind,
  });
  return toAdminImageViews({ _id: eventId, images: docs });
}

export async function updateImage(
  actorId: string,
  eventId: string,
  imageId: string,
  patch: PatchImageBody,
): Promise<AdminEventImageView> {
  const set: Record<string, unknown> = {};
  if (patch.kind !== undefined) set["images.$.kind"] = patch.kind;
  if (patch.alt !== undefined) set["images.$.alt"] = patch.alt;
  if (patch.sortOrder !== undefined) set["images.$.sortOrder"] = patch.sortOrder;
  const e = await EventModel.findOneAndUpdate(
    { _id: eventId, archived: false, "images._id": imageId },
    { $set: set },
    { new: true, projection: { images: 1 } },
  ).lean();
  if (!e) {
    if (!(await EventModel.exists({ _id: eventId, archived: false })))
      throw eventNotFound();
    throw imageNotFound();
  }
  await audit(actorId, "event.image.update", "Event", eventId, {
    imageId,
    fields: Object.keys(patch),
  });
  const view = toAdminImageViews(e).find((i) => i.id === imageId);
  if (!view) throw imageNotFound();
  return view;
}

export async function reorderImages(
  actorId: string,
  eventId: string,
  ids: string[],
): Promise<AdminEventImageView[]> {
  const e = await EventModel.findOne(
    { _id: eventId, archived: false },
    { images: 1 },
  ).lean();
  if (!e) throw eventNotFound();
  const current = (e.images ?? []).map((i) => String(i._id));
  const same =
    ids.length === current.length && ids.every((id) => current.includes(id));
  if (!same)
    throw ApiError.validation({
      ids: "รายการรูปภาพไม่ตรงกับที่มีอยู่ กรุณาโหลดใหม่",
    });

  const set: Record<string, number> = {};
  ids.forEach((_, i) => (set[`images.$[a${i}].sortOrder`] = i));
  const res = await EventModel.updateOne(
    // The size guard makes a concurrent upload/delete fail the write instead of being half-ordered.
    { _id: eventId, archived: false, images: { $size: current.length } },
    { $set: set },
    {
      arrayFilters: ids.map((id, i) => ({
        [`a${i}._id`]: new Types.ObjectId(id),
      })),
    },
  );
  if (res.matchedCount === 0)
    throw ApiError.conflict(
      "IMAGE_ORDER_STALE",
      "รายการรูปภาพมีการเปลี่ยนแปลง กรุณาโหลดใหม่",
    );
  await audit(actorId, "event.image.reorder", "Event", eventId, {
    count: ids.length,
  });
  return listImages(eventId);
}

export async function removeImage(
  actorId: string,
  eventId: string,
  imageId: string,
): Promise<void> {
  const before = await EventModel.findOneAndUpdate(
    { _id: eventId, archived: false, "images._id": imageId },
    { $pull: { images: { _id: imageId } } },
    { projection: { images: 1 } },
  ).lean();
  if (!before) {
    if (!(await EventModel.exists({ _id: eventId, archived: false })))
      throw eventNotFound();
    throw imageNotFound();
  }
  const image = (before.images ?? []).find((i) => String(i._id) === imageId);
  // The DB is the source of truth: a missing/undeletable file never fails the request.
  if (image) await deleteEventImage(eventId, image.filename);
  await audit(actorId, "event.image.delete", "Event", eventId, { imageId });
}

// --- file lookup -------------------------------------------------------

/**
 * Resolves an image id to a safe on-disk path. The path comes only from DB fields (event `_id`
 * + stored filename), never from the request. Public lookups only see non-archived, non-draft events;
 * the admin variant (`adminEventId`) also sees drafts.
 */
export async function getImageFile(
  imageId: string,
  adminEventId?: string,
): Promise<{ fullPath: string; mime: string }> {
  const filter = adminEventId
    ? { _id: adminEventId, archived: false, "images._id": imageId }
    : {
        archived: false,
        status: { $in: [...PUBLIC_EVENT_STATUSES] },
        "images._id": imageId,
      };
  const e = await EventModel.findOne(filter, { "images.$": 1 }).lean();
  const image = e?.images?.[0];
  if (!e || !image) throw imageNotFound();
  try {
    return {
      fullPath: resolveEventImagePath(String(e._id), image.filename),
      mime: image.mime,
    };
  } catch {
    throw imageNotFound();
  }
}
