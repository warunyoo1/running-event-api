import type { CookieOptions, Request, Response } from "express";
import { COOKIE_NAME } from "../config/constants";
import { env } from "../config/env";
import { validatedBody } from "../middlewares/validate";
import * as authService from "../services/auth.service";
import { done, ok } from "../utils/response";
import type {
  ChangePasswordBody,
  LoginBody,
} from "../validators/auth.validator";

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  secure: env.cookieSecure,
  path: "/",
});

export async function login(req: Request, res: Response) {
  const { email, password } = validatedBody<LoginBody>(req);
  const { token, maxAgeMs, user } = await authService.login(email, password);
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: maxAgeMs });
  ok(res, user);
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  done(res, "ออกจากระบบสำเร็จ");
}

export async function me(req: Request, res: Response) {
  ok(res, await authService.getMe(req.user!.id));
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } =
    validatedBody<ChangePasswordBody>(req);
  await authService.changePassword(req.user!.id, currentPassword, newPassword);
  done(res, "เปลี่ยนรหัสผ่านสำเร็จ");
}
