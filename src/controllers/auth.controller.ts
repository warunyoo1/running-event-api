import type { CookieOptions, Request, Response } from "express";
import { COOKIE_NAME } from "../config/constants";
import { env } from "../config/env";
import * as authService from "../services/auth.service";
import { ok } from "../utils/response";

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  secure: env.cookieSecure,
  path: "/",
});

export async function login(req: Request, res: Response) {
  const { token, user } = await authService.login(
    req.body.email,
    req.body.password,
  );
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: 8 * 3600_000 });
  ok(res, user);
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  ok(res, await authService.getMe(req.user!.id));
}

export async function changePassword(req: Request, res: Response) {
  await authService.changePassword(
    req.user!.id,
    req.body.currentPassword,
    req.body.newPassword,
  );
  res.status(204).end();
}
