import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../models";
import { ApiError } from "../utils/api-error";
import { audit } from "./audit.service";

type Patch = {
  name?: string;
  role?: "super_admin" | "reviewer" | "viewer";
  active?: boolean;
  password?: string;
};

export async function list() {
  const users = await User.find().sort({ createdAt: 1 });
  return users.map((u) => u.toJSON());
}

export async function create(
  actorId: string,
  input: {
    name: string;
    email: string;
    password: string;
    role: "super_admin" | "reviewer" | "viewer";
  },
) {
  if (await User.exists({ email: input.email }))
    throw ApiError.conflict("EMAIL_TAKEN", "อีเมลนี้ถูกใช้แล้ว");
  const user = await User.create({
    name: input.name,
    email: input.email,
    role: input.role,
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

export async function update(actorId: string, id: string, patch: Patch) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound("ไม่พบผู้ใช้", "USER_NOT_FOUND");

  const wasActiveSuper = user.role === "super_admin" && user.active;
  const willBeActiveSuper =
    (patch.role ?? user.role) === "super_admin" &&
    (patch.active ?? user.active);
  const losesSuper = wasActiveSuper && !willBeActiveSuper;
  const guardMsg = "ต้องมี super_admin ที่ใช้งานอยู่อย่างน้อย 1 คน";
  if (losesSuper && (await activeSupers(id)) === 0)
    throw ApiError.conflict("LAST_SUPER_ADMIN", guardMsg);

  const before = {
    name: user.name,
    role: user.role,
    active: user.active,
    passwordHash: user.passwordHash,
  };
  if (patch.name !== undefined) user.name = patch.name;
  if (patch.role !== undefined) user.role = patch.role;
  if (patch.active !== undefined) user.active = patch.active;
  if (patch.password !== undefined)
    user.passwordHash = await bcrypt.hash(patch.password, env.BCRYPT_COST);
  await user.save();

  // Re-check after write so two concurrent demotions can never leave zero super admins.
  if (losesSuper && (await activeSupers()) === 0) {
    user.set(before);
    await user.save();
    throw ApiError.conflict("LAST_SUPER_ADMIN", guardMsg);
  }
  await audit(actorId, "user.update", "User", id, {
    fields: Object.keys(patch).filter((k) => k !== "password"),
    passwordReset: patch.password !== undefined,
  });
  return user.toJSON();
}
