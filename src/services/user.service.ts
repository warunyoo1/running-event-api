import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { AuditLog, Order, OrderNote, Payment, User } from "../models";
import type { UserJson } from "../models/user.model";
import { ApiError } from "../utils/api-error";
import type {
  CreateUserBody,
  UpdateUserBody,
} from "../validators/user.validator";
import { audit } from "./audit.service";

const LAST_SUPER_ADMIN_MSG = "ต้องมี super_admin ที่ใช้งานอยู่อย่างน้อย 1 คน";

/** True when `actorId` would deactivate or change the role of their own account. */
export function violatesSelfGuard(
  actorId: string,
  id: string,
  user: { role: string },
  patch: Pick<UpdateUserBody, "active" | "role">,
): boolean {
  return (
    actorId === id &&
    (patch.active === false ||
      (patch.role !== undefined && patch.role !== user.role))
  );
}

export type HardDeleteBlock = "self" | "active" | "history";

/** Why a user cannot be permanently deleted, in precedence order self -> active -> history; null when allowed. */
export function canHardDelete(state: {
  self: boolean;
  active: boolean;
  hasHistory: boolean;
}): { ok: true } | { ok: false; reason: HardDeleteBlock } {
  if (state.self) return { ok: false, reason: "self" };
  if (state.active) return { ok: false, reason: "active" };
  if (state.hasHistory) return { ok: false, reason: "history" };
  return { ok: true };
}

export async function list(): Promise<UserJson[]> {
  const users = await User.find().sort({ createdAt: 1 });
  return users.map((u) => u.toJSON());
}

export async function create(
  actorId: string,
  input: CreateUserBody,
): Promise<UserJson> {
  if (await User.exists({ email: input.email }))
    throw ApiError.conflict("EMAIL_TAKEN", "อีเมลนี้ถูกใช้แล้ว");
  const user = await User.create({
    name: input.name,
    email: input.email,
    role: input.role,
    mustChangePassword: true,
    passwordHash: await bcrypt.hash(input.password, env.BCRYPT_COST),
  });
  await audit(actorId, "user.create", "User", String(user._id), {
    role: input.role,
  });
  return user.toJSON();
}

const activeSupers = (excludeId?: string) =>
  User.countDocuments({
    role: "super_admin",
    active: true,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });

export async function update(
  actorId: string,
  id: string,
  patch: UpdateUserBody,
): Promise<UserJson> {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound("ไม่พบผู้ใช้", "USER_NOT_FOUND");

  if (violatesSelfGuard(actorId, id, user, patch))
    throw ApiError.conflict(
      "CANNOT_MODIFY_SELF",
      "ปิดใช้งานหรือเปลี่ยนบทบาทของบัญชีตัวเองไม่ได้",
    );

  const emailChanged = patch.email !== undefined && patch.email !== user.email;
  if (
    emailChanged &&
    (await User.exists({ email: patch.email, _id: { $ne: id } }))
  )
    throw ApiError.conflict("EMAIL_TAKEN", "อีเมลนี้ถูกใช้แล้ว");

  const wasActiveSuper = user.role === "super_admin" && user.active;
  const willBeActiveSuper =
    (patch.role ?? user.role) === "super_admin" &&
    (patch.active ?? user.active);
  const losesSuper = wasActiveSuper && !willBeActiveSuper;
  if (losesSuper && (await activeSupers(id)) === 0)
    throw ApiError.conflict("LAST_SUPER_ADMIN", LAST_SUPER_ADMIN_MSG);

  const before = {
    name: user.name,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
    role: user.role,
    active: user.active,
    passwordHash: user.passwordHash,
  };
  if (patch.name !== undefined) user.name = patch.name;
  if (emailChanged && patch.email !== undefined) user.email = patch.email;
  if (patch.role !== undefined) user.role = patch.role;
  if (patch.active !== undefined) user.active = patch.active;
  if (patch.password !== undefined) {
    user.passwordHash = await bcrypt.hash(patch.password, env.BCRYPT_COST);
    if (actorId !== id) user.mustChangePassword = true;
  }
  await user.save();

  // Re-check after write so two concurrent demotions can never leave zero super admins.
  if (losesSuper && (await activeSupers()) === 0) {
    user.set(before);
    await user.save();
    throw ApiError.conflict("LAST_SUPER_ADMIN", LAST_SUPER_ADMIN_MSG);
  }
  await audit(actorId, "user.update", "User", id, {
    fields: Object.keys(patch).filter((k) => k !== "password"),
    passwordReset: patch.password !== undefined,
    ...(emailChanged ? { email: { from: before.email, to: user.email } } : {}),
  });
  return user.toJSON();
}

export async function remove(actorId: string, id: string): Promise<void> {
  if (actorId === id)
    throw ApiError.conflict("CANNOT_DELETE_SELF", "ลบบัญชีของตัวเองไม่ได้");
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound("ไม่พบผู้ใช้", "USER_NOT_FOUND");
  if (user.active)
    throw ApiError.conflict(
      "USER_STILL_ACTIVE",
      "ต้องปิดใช้งานผู้ใช้ก่อนจึงจะลบถาวรได้",
    );
  const [logged, reviewedOrder, reviewedPayment, wroteNote] = await Promise.all([
    AuditLog.exists({ userId: id }),
    Order.exists({ reviewedBy: id }),
    Payment.exists({ reviewedBy: id }),
    OrderNote.exists({ authorId: id }),
  ]);
  const verdict = canHardDelete({
    self: false,
    active: user.active,
    hasHistory: Boolean(
      logged || reviewedOrder || reviewedPayment || wroteNote,
    ),
  });
  if (!verdict.ok && verdict.reason === "history")
    throw ApiError.conflict(
      "USER_HAS_HISTORY",
      "ผู้ใช้นี้มีประวัติการใช้งานในระบบ ให้ปิดใช้งานแทนการลบ",
    );
  const res = await User.deleteOne({ _id: id, active: false });
  if (res.deletedCount === 0)
    throw ApiError.conflict(
      "INVALID_STATE",
      "สถานะผู้ใช้เปลี่ยนไปแล้ว กรุณาลองใหม่",
    );
  await audit(actorId, "user.delete", "User", id, {
    email: user.email,
    name: user.name,
    role: user.role,
  });
}
