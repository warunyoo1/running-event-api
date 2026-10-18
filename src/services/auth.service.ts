import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { User } from "../models";
import type { UserJson } from "../models/user.model";
import { ApiError } from "../utils/api-error";
import { audit } from "./audit.service";

// Compared against when the email is unknown so response time doesn't reveal existence.
const dummyHash = bcrypt.hashSync("dummy-password-for-timing", env.BCRYPT_COST);

export function signToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

/** Lifetime of a signed token (exp - iat) in ms, so the cookie never outlives JWT_EXPIRES_IN. */
function tokenLifetimeMs(token: string): number {
  const { iat = 0, exp = 0 } = jwt.decode(token) as jwt.JwtPayload;
  return (exp - iat) * 1000;
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; maxAgeMs: number; user: UserJson }> {
  const user = await User.findOne({ email });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !ok || !user.active)
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    );
  user.lastLoginAt = new Date();
  await user.save();
  await audit(String(user._id), "auth.login", "User", String(user._id));
  const token = signToken(String(user._id));
  return { token, maxAgeMs: tokenLifetimeMs(token), user: user.toJSON() };
}

export async function getMe(userId: string): Promise<UserJson> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized();
  return user.toJSON();
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized();
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw ApiError.validation({
      currentPassword: "รหัสผ่านปัจจุบันไม่ถูกต้อง",
    });
  }
  if (currentPassword === newPassword)
    throw ApiError.validation({
      newPassword: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม",
    });
  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_COST);
  user.mustChangePassword = false;
  await user.save();
  await audit(userId, "auth.change_password", "User", userId);
}
