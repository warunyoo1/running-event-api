import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { HTTP_STATUS } from "../config/constants";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxSlipBytes, files: 1, fields: 5, parts: 8 },
});

/** Single file field `slip` held in memory; type is verified by magic bytes in the service. */
export const uploadSlip = (req: Request, res: Response, next: NextFunction) =>
  uploader.single("slip")(req, res, (err?: unknown) => {
    // Malformed multipart bodies surface as plain Errors from busboy: report them as 400, not 500.
    if (err && !(err instanceof multer.MulterError) && !(err instanceof ApiError))
      return next(
        new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          "UPLOAD_ERROR",
          "อัปโหลดไฟล์ไม่สำเร็จ",
        ),
      );
    next(err);
  });
