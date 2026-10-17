import type { Response } from "express";
import {
  DEFAULT_SUCCESS_MESSAGE,
  HTTP_STATUS,
  STATUS_MESSAGE,
} from "../config/constants";

export type Meta = Record<string, unknown>;

const NO_BODY_STATUSES: number[] = [
  HTTP_STATUS.NO_CONTENT,
  HTTP_STATUS.NOT_MODIFIED,
];
const RESERVED_KEYS = ["statusCode", "success", "message"] as const;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Wraps a JSON body in the standard envelope:
 * `{ statusCode, success, message, ...body }` (existing keys kept as-is, after the three new ones).
 * Idempotent; bodies with colliding top-level keys are nested under `data`.
 */
export function buildEnvelope(
  status: number,
  body: unknown,
  message?: string,
): unknown {
  if (status < 200 || NO_BODY_STATUSES.includes(status)) return body;
  if (
    isPlainObject(body) &&
    Object.hasOwn(body, "statusCode") &&
    typeof body.success === "boolean"
  )
    return body; // already enveloped
  let payload: Record<string, unknown>;
  if (!isPlainObject(body)) payload = { data: body };
  else if (RESERVED_KEYS.some((k) => Object.hasOwn(body, k)))
    payload = { data: body };
  else payload = body;
  const error = payload.error;
  const errorMessage =
    isPlainObject(error) && typeof error.message === "string"
      ? error.message
      : undefined;
  const text =
    message ??
    errorMessage ??
    STATUS_MESSAGE[status] ??
    (status < 400
      ? DEFAULT_SUCCESS_MESSAGE
      : STATUS_MESSAGE[HTTP_STATUS.INTERNAL_SERVER_ERROR]);
  return { statusCode: status, success: status < 400, message: text, ...payload };
}

/** 200 response. Optional `message` overrides the default envelope message. */
export function ok<T>(res: Response, data: T, meta?: Meta, message?: string) {
  if (message) res.locals.responseMessage = message;
  return res.json(meta ? { data, meta } : { data });
}

export function created<T>(
  res: Response,
  data: T,
  opts?: { location?: string; message?: string },
) {
  if (opts?.message) res.locals.responseMessage = opts.message;
  if (opts?.location) res.location(opts.location);
  return res.status(HTTP_STATUS.CREATED).json({ data });
}

/** 200 with `data: null` (replaces the former bodiless 204). */
export function done(res: Response, message?: string) {
  return ok(res, null, undefined, message);
}
