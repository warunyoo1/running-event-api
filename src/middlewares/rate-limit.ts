import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";

const handler = (_req: Request, _res: unknown, next: (e: unknown) => void) =>
  next(new ApiError(429, "RATE_LIMITED", "คำขอมากเกินไป กรุณาลองใหม่ภายหลัง"));

const base = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  handler,
};
const ip = (req: Request) => ipKeyGenerator(req.ip ?? "unknown");

export const publicLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: env.PUBLIC_RATE_MAX,
  keyGenerator: ip,
});
/** Stricter: order creation, order lookup and slip upload. */
export const orderLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: env.ORDER_RATE_MAX,
  keyGenerator: ip,
});
/** Login: per IP + email, only failed attempts count. */
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: env.LOGIN_RATE_MAX,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    `${ip(req)}|${String(req.body?.email ?? "")
      .toLowerCase()
      .slice(0, 200)}`,
});
