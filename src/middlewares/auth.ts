import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { COOKIE_NAME, roles, type Role } from "../config/constants";
import { env } from "../config/env";
import { User } from "../models";
import { ApiError } from "../utils/api-error";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (typeof token !== "string" || !token) throw ApiError.unauthorized();
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    } catch {
      throw ApiError.unauthorized("เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
    }
    // Reload from DB so deactivation / role changes apply immediately.
    const user = await User.findById(payload.sub);
    if (!user || !user.active) throw ApiError.unauthorized();
    req.user = { id: String(user._id), email: user.email, name: user.name, role: user.role as Role };
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole = (...allowed: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!allowed.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};

export const ALL_ROLES: Role[] = [...roles];
export const WRITE_ROLES: Role[] = ["super_admin", "reviewer"];
export const SUPER_ONLY: Role[] = ["super_admin"];
