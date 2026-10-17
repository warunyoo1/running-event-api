import type { Request, Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { HTTP_STATUS } from "../config/constants";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";

const handler = (
  req: Request,
  res: Response,
  next: (e: unknown) => void,
) => {
  if (!res.getHeader("Retry-After")) {
    const info = (req as Request & { rateLimit?: { resetTime?: Date } })
      .rateLimit;
    const resetMs = info?.resetTime?.getTime() ?? Date.now();
    res.set("Retry-After", String(Math.max(1, Math.ceil((resetMs - Date.now()) / 1000))));
  }
  next(
    new ApiError(
      HTTP_STATUS.TOO_MANY_REQUESTS,
      "RATE_LIMITED",
      "คำขอมากเกินไป กรุณาลองใหม่ภายหลัง",
    ),
  );
};

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
