import bcrypt from "bcryptjs";
import type { Role } from "../config/constants";
import { env } from "../config/env";
import { User } from "../models";
import { decideAdminSeed, type AdminSeedConfig, type AdminSeedDecision } from "./admin-seed-rules";

/** Create a user unless one with this email exists (never updates an existing user). */
export async function ensureUser(name: string, email: string, password: string, role: Role, extra: { mustChangePassword?: boolean } = {}) {
  const existing = await User.findOne({ email });
  if (existing) return { user: existing, created: false };
  const user = await User.create({ name, email, role, active: true, ...extra, passwordHash: await bcrypt.hash(password, env.BCRYPT_COST) });
  return { user, created: true };
}

/**
 * Idempotent first-admin seed. Standalone Mongo, no transactions: a concurrent run is
 * resolved by the unique email index (duplicate key 11000 => "exists").
 */
export async function ensureFirstAdmin(cfg: AdminSeedConfig): Promise<AdminSeedDecision> {
  const [emailExists, activeSuperAdminExists] = await Promise.all([
    User.exists({ email: cfg.email }),
    User.exists({ role: "super_admin", active: true }),
  ]);
  const decision = decideAdminSeed({ emailExists: Boolean(emailExists), activeSuperAdminExists: Boolean(activeSuperAdminExists) });
  if (decision !== "create") return decision;
  try {
    await ensureUser(cfg.name, cfg.email, cfg.password, "super_admin", { mustChangePassword: true });
    return "create";
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return "skip-exists";
    throw err;
  }
}
