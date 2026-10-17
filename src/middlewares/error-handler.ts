import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";
import { ApiError } from "../utils/api-error";
import { flattenZod } from "../validators/common.validator";

type DupKeyError = {
  code: number;
  keyPattern?: Record<string, unknown>;
  message?: string;
};

const dupMap: Record<string, [string, string]> = {
  slug_unique: ["SLUG_TAKEN", "slug นี้ถูกใช้แล้ว"],
  email_unique: ["EMAIL_TAKEN", "อีเมลนี้ถูกใช้แล้ว"],
  event_bib_unique: ["DUPLICATE_BIB", "หมายเลข BIB นี้ถูกใช้แล้วในงานนี้"],
  paid_transactionRef_unique: [
    "DUPLICATE_TRANSACTION_REF",
    "เลขอ้างอิงนี้ถูกใช้กับออเดอร์ที่ชำระแล้ว",
  ],
  event_race_unique: ["DUPLICATE_RACE", "ชื่อระยะซ้ำกัน"],
};

function send(
  res: Response,
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
) {
  res
    .status(status)
    .json({ error: { code, message, ...(fields ? { fields } : {}) } });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError)
    return send(res, err.status, err.code, err.message, err.fields);
  if (err instanceof ZodError)
    return send(
      res,
      422,
      "VALIDATION_ERROR",
      "ข้อมูลไม่ถูกต้อง",
      flattenZod(err),
    );
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE")
      return send(res, 413, "FILE_TOO_LARGE", "ไฟล์ใหญ่เกินกำหนด");
    return send(res, 400, "UPLOAD_ERROR", "อัปโหลดไฟล์ไม่สำเร็จ");
  }
  const e = err as DupKeyError & { type?: string; status?: number };
  if (e?.code === 11000) {
    const hit = Object.entries(dupMap).find(([name]) =>
      e.message?.includes(name),
    );
    if (hit) return send(res, 409, hit[1][0], hit[1][1]);
    return send(res, 409, "DUPLICATE", "ข้อมูลซ้ำ");
  }
  if (err instanceof mongoose.Error.CastError)
    return send(res, 404, "NOT_FOUND", "ไม่พบข้อมูล");
  if (e?.type === "entity.parse.failed")
    return send(res, 400, "INVALID_JSON", "รูปแบบ JSON ไม่ถูกต้อง");
  if (e?.type === "entity.too.large")
    return send(res, 413, "PAYLOAD_TOO_LARGE", "ข้อมูลที่ส่งมาใหญ่เกินไป");
  console.error("Unhandled error:", err);
  send(res, 500, "INTERNAL_ERROR", "เกิดข้อผิดพลาดภายในระบบ");
}
