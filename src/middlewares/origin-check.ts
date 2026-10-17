import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/** CSRF defence-in-depth: browser requests that mutate must come from an allowed origin. */
export function originCheck(req: Request, _res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // non-browser client (curl, server-to-server)
  if (env.corsOrigins.includes(origin)) return next();
  next(ApiError.forbidden("origin ไม่ได้รับอนุญาต"));
}
