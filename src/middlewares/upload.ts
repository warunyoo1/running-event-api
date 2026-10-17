import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { env } from "../config/env";

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxSlipBytes, files: 1, fields: 5, parts: 8 },
});

/** Single file field `slip` held in memory; type is verified by magic bytes in the service. */
export const uploadSlip = (req: Request, res: Response, next: NextFunction) =>
  uploader.single("slip")(req, res, next);
