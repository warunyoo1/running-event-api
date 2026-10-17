import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  EVENT_IMAGE_MAX_BYTES,
  EVENT_IMAGE_MAX_FILES_PER_REQUEST,
  HTTP_STATUS,
} from "../config/constants";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxSlipBytes, files: 1, fields: 5, parts: 8 },
});

// Memory storage: size/count limits are enforced while streaming and nothing touches disk
// until the service has verified every file by magic bytes.
const imageUploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: EVENT_IMAGE_MAX_BYTES,
    files: EVENT_IMAGE_MAX_FILES_PER_REQUEST,
    fields: 4,
    fieldSize: 2048,
    parts: EVENT_IMAGE_MAX_FILES_PER_REQUEST + 4,
  },
});

/** Malformed multipart bodies surface as plain Errors from busboy: report them as 400, not 500. */
const wrap =
  (next: NextFunction) =>
  (err?: unknown) => {
    if (err && !(err instanceof multer.MulterError) && !(err instanceof ApiError))
      return next(
        new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          "UPLOAD_ERROR",
          "อัปโหลดไฟล์ไม่สำเร็จ",
        ),
      );
    next(err);
  };

/** Single file field `slip` held in memory; type is verified by magic bytes in the service. */
export const uploadSlip = (req: Request, res: Response, next: NextFunction) =>
  uploader.single("slip")(req, res, wrap(next));

/**
 * File field `files` (many) held in memory. No `maxCount` on purpose: the 11th file then trips
 * `limits.files` (LIMIT_FILE_COUNT -> 422 TOO_MANY_FILES); other field names give LIMIT_UNEXPECTED_FILE (400).
 */
export const uploadEventImages = (
  req: Request,
  res: Response,
  next: NextFunction,
) => imageUploader.array("files")(req, res, wrap(next));
