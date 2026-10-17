import mongoose from "mongoose";
import { z, type ZodError } from "zod";
import type { FieldErrors } from "../utils/api-error";

export const objectIdParam = z.object({
  id: z.string().refine((v) => mongoose.isValidObjectId(v), "invalid id"),
});
export const orderNoParam = z.object({ orderNo: z.string().min(1).max(40) });
export const slugParam = z.object({ slug: z.string().min(1).max(120) });

export const objectId = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), "invalid id");

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Optional trimmed query string: empty string becomes undefined. */
export const optStr = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(200).optional(),
);

/** Flatten a ZodError into `{ "participants.0.firstName": "message" }`. First message per path wins. */
export function flattenZod(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "body";
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

/** Today in Asia/Bangkok as YYYY-MM-DD. */
export function bangkokToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
