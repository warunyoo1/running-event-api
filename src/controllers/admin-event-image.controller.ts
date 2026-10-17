import type { NextFunction, Request, Response } from "express";
import { API_PREFIX, EVENT_IMAGE_CACHE_CONTROL } from "../config/constants";
import { validatedBody, validatedParams } from "../middlewares/validate";
import * as imageService from "../services/event-image.service";
import { ApiError } from "../utils/api-error";
import { created, done, ok } from "../utils/response";
import type {
  IdParams,
  ImageParams,
  PublicImageParams,
} from "../validators/common.validator";
import type {
  PatchImageBody,
  ReorderBody,
  UploadImagesBody,
} from "../validators/event.validator";

export async function list(_req: Request, res: Response) {
  ok(res, await imageService.listImages(validatedParams<IdParams>(res).id));
}

export async function upload(req: Request, res: Response) {
  const { id } = validatedParams<IdParams>(res);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const images = await imageService.addImages(
    req.user!.id,
    id,
    files,
    validatedBody<UploadImagesBody>(req),
  );
  created(res, images, { location: `${API_PREFIX}/admin/events/${id}` });
}

export async function patch(req: Request, res: Response) {
  const { id, imageId } = validatedParams<ImageParams>(res);
  ok(
    res,
    await imageService.updateImage(
      req.user!.id,
      id,
      imageId,
      validatedBody<PatchImageBody>(req),
    ),
  );
}

export async function reorder(req: Request, res: Response) {
  const { id } = validatedParams<IdParams>(res);
  ok(
    res,
    await imageService.reorderImages(
      req.user!.id,
      id,
      validatedBody<ReorderBody>(req).ids,
    ),
  );
}

export async function remove(req: Request, res: Response) {
  const { id, imageId } = validatedParams<ImageParams>(res);
  await imageService.removeImage(req.user!.id, id, imageId);
  done(res);
}

/** Streams the stored bytes (not enveloped). Headers come from DB values only. */
function sendImage(
  res: Response,
  next: NextFunction,
  file: { fullPath: string; mime: string },
  cacheControl: string,
) {
  res.setHeader("Content-Type", file.mime);
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  // dotfiles "allow": the path is built from validated parts (see resolveEventImagePath).
  res.sendFile(file.fullPath, { dotfiles: "allow" }, (err) => {
    // The DB row exists but the file is gone (or unreadable).
    if (err && !res.headersSent) {
      // Drop the image headers so the JSON error is not served as image/* with a year-long cache.
      for (const h of ["Content-Type", "Cache-Control", "Content-Disposition"])
        res.removeHeader(h);
      next(ApiError.notFound("ไม่พบรูปภาพ", "IMAGE_NOT_FOUND"));
    }
  });
}

/** Admin preview: also serves images of draft events. */
export async function adminFile(_req: Request, res: Response, next: NextFunction) {
  const { id, imageId } = validatedParams<ImageParams>(res);
  sendImage(
    res,
    next,
    await imageService.getImageFile(imageId, id),
    "private, max-age=3600",
  );
}

/** Public image: no login, only non-draft, non-archived events. */
export async function publicFile(_req: Request, res: Response, next: NextFunction) {
  const { imageId } = validatedParams<PublicImageParams>(res);
  sendImage(
    res,
    next,
    await imageService.getImageFile(imageId),
    EVENT_IMAGE_CACHE_CONTROL,
  );
}
