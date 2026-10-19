// Pure rules for the admin-only seed (no DB, no env import) so they are unit-testable.

export const MIN_ADMIN_PASSWORD_LENGTH = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AdminSeedConfig = { email: string; password: string; name: string };

export type AdminSeedConfigResult =
  | { kind: "unset" }
  | { kind: "invalid"; reason: string }
  | { kind: "ok"; config: AdminSeedConfig };

export type AdminSeedDecision = "create" | "skip-exists" | "skip-has-admin";

/** Parse SEED_ADMIN_* values. Email is trimmed + lowercased like the login/User schema. */
export function parseAdminSeedConfig(source: Record<string, string | undefined>): AdminSeedConfigResult {
  const email = (source.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = source.SEED_ADMIN_PASSWORD ?? "";
  if (!email || !password) return { kind: "unset" };
  if (!EMAIL_RE.test(email)) return { kind: "invalid", reason: "SEED_ADMIN_EMAIL is not a valid email" };
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return { kind: "invalid", reason: `SEED_ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters` };
  }
  return { kind: "ok", config: { email, password, name: source.SEED_ADMIN_NAME?.trim() || "Super Admin" } };
}

/** Skip if the email is taken, or if any active super_admin already exists; otherwise create. */
export function decideAdminSeed(state: { emailExists: boolean; activeSuperAdminExists: boolean }): AdminSeedDecision {
  if (state.emailExists) return "skip-exists";
  if (state.activeSuperAdminExists) return "skip-has-admin";
  return "create";
}
