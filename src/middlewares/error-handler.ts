import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";
import {
  HTTP_STATUS,
  RETRY_AFTER_UNAVAILABLE_SEC,
  STATUS_MESSAGE,
} from "../config/constants";
import { ApiError, type FieldErrors } from "../utils/api-error";
import { flattenZod } from "../validators/common.validator";

type DupKeyError = {
  code?: number | string;
  keyPattern?: Record<string, unknown>;
  message?: string;
  name?: string;
  type?: string;
  status?: number;
  statusCode?: number;
};

type Resolved = {
  status: number;
  code: string;
  message: string;
  fields?: FieldErrors;
  headers?: Record<string, string>;
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

/** Mongo driver / Mongoose errors that mean "database not reachable right now". */
const MONGO_UNAVAILABLE_NAMES = new Set([
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoServerSelectionError",
  "MongooseServerSelectionError",
  "MongoTopologyClosedError",
  "MongoNotConnectedError",
  "MongoPoolClearedError",
  "MongoPoolClosedError",
  "MongoWaitQueueTimeoutError",
]);
const MONGO_MAX_TIME_MS_EXPIRED = 50;

function isMongoUnavailable(err: unknown): boolean {
  const e = err as DupKeyError | null;
  if (!e || typeof e !== "object") return false;
  if (e.name && MONGO_UNAVAILABLE_NAMES.has(e.name)) return true;
  if (e.name === "MongoServerError" && e.code === MONGO_MAX_TIME_MS_EXPIRED)
    return true;
  return (
    err instanceof mongoose.Error && /buffering timed out/i.test(err.message)
  );
}

const make = (
  status: number,
  code: string,
  message: string,
  fields?: FieldErrors,
): Resolved => ({ status, code, message, ...(fields ? { fields } : {}) });

/** Pure mapping from any thrown value to status + error body. Unknown errors become a generic 500. */
function resolveError(err: unknown): Resolved {
  if (err instanceof ApiError)
    return make(err.status, err.code, err.message, err.fields);
  if (err instanceof ZodError)
    return make(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      "VALIDATION_ERROR",
      "ข้อมูลไม่ถูกต้อง",
      flattenZod(err),
    );
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE")
      return make(
        HTTP_STATUS.PAYLOAD_TOO_LARGE,
        "FILE_TOO_LARGE",
        "ไฟล์ใหญ่เกินกำหนด",
      );
    return make(
      HTTP_STATUS.BAD_REQUEST,
      "UPLOAD_ERROR",
      "อัปโหลดไฟล์ไม่สำเร็จ",
    );
  }
  if (err instanceof jwt.JsonWebTokenError)
    return make(
      HTTP_STATUS.UNAUTHORIZED,
      "UNAUTHORIZED",
      "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง",
    );
  if (err instanceof mongoose.Error.ValidationError) {
    const fields: FieldErrors = {};
    for (const [path, e] of Object.entries(err.errors)) fields[path] = e.message;
    return make(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      "VALIDATION_ERROR",
      "ข้อมูลไม่ถูกต้อง",
      fields,
    );
  }
  if (err instanceof mongoose.Error.CastError)
    return make(
      HTTP_STATUS.BAD_REQUEST,
      "BAD_REQUEST",
      "ข้อมูลที่ส่งมามีรูปแบบไม่ถูกต้อง",
    );
  const e = err as DupKeyError | null;
  if (e?.code === 11000) {
    const hit = Object.entries(dupMap).find(([name]) =>
      e.message?.includes(name),
    );
    if (hit) return make(HTTP_STATUS.CONFLICT, hit[1][0], hit[1][1]);
    return make(HTTP_STATUS.CONFLICT, "DUPLICATE", "ข้อมูลซ้ำ");
  }
  if (isMongoUnavailable(err)) {
    console.error("Database unavailable:", err);
    return {
      ...make(
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        "SERVICE_UNAVAILABLE",
        STATUS_MESSAGE[HTTP_STATUS.SERVICE_UNAVAILABLE],
      ),
      headers: { "Retry-After": String(RETRY_AFTER_UNAVAILABLE_SEC) },
    };
  }
  if (e?.type === "entity.parse.failed")
    return make(
      HTTP_STATUS.BAD_REQUEST,
      "INVALID_JSON",
      "รูปแบบ JSON ไม่ถูกต้อง",
    );
  if (e?.type === "entity.too.large")
    return make(
      HTTP_STATUS.PAYLOAD_TOO_LARGE,
      "PAYLOAD_TOO_LARGE",
      "ข้อมูลที่ส่งมาใหญ่เกินไป",
    );
  if (e?.type === "encoding.unsupported" || e?.type === "charset.unsupported")
    return make(
      HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
      "UNSUPPORTED_MEDIA_TYPE",
      STATUS_MESSAGE[HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE],
    );
  // http-errors style client errors (router URIError, request.aborted, ...): generic 400 only.
  const status = e?.status ?? e?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500)
    return make(
      HTTP_STATUS.BAD_REQUEST,
      "BAD_REQUEST",
      STATUS_MESSAGE[HTTP_STATUS.BAD_REQUEST],
    );
  console.error("Unhandled error:", err);
  return make(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    "INTERNAL_ERROR",
    STATUS_MESSAGE[HTTP_STATUS.INTERNAL_SERVER_ERROR],
  );
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) return next(err);
  const r = resolveError(err);
  if (r.headers) res.set(r.headers);
  // responseEnvelope adds statusCode/success/message around this body.
  res.status(r.status).json({
    error: {
      code: r.code,
      message: r.message,
      ...(r.fields ? { fields: r.fields } : {}),
    },
  });
}
