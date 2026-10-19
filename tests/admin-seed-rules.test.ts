import { describe, expect, it } from "vitest";
import { decideAdminSeed, parseAdminSeedConfig } from "../src/seed/admin-seed-rules";

describe("parseAdminSeedConfig", () => {
  it("is unset when email or password is missing/blank", () => {
    expect(parseAdminSeedConfig({}).kind).toBe("unset");
    expect(parseAdminSeedConfig({ SEED_ADMIN_EMAIL: "a@b.co" }).kind).toBe("unset");
    expect(parseAdminSeedConfig({ SEED_ADMIN_EMAIL: "  ", SEED_ADMIN_PASSWORD: "x".repeat(12) }).kind).toBe("unset");
    expect(parseAdminSeedConfig({ SEED_ADMIN_PASSWORD: "x".repeat(12) }).kind).toBe("unset");
  });

  it("rejects bad email and short password without echoing the password", () => {
    const badEmail = parseAdminSeedConfig({ SEED_ADMIN_EMAIL: "nope", SEED_ADMIN_PASSWORD: "x".repeat(12) });
    expect(badEmail.kind).toBe("invalid");
    const short = parseAdminSeedConfig({ SEED_ADMIN_EMAIL: "a@b.co", SEED_ADMIN_PASSWORD: "short-pw" });
    expect(short.kind).toBe("invalid");
    expect(JSON.stringify(short)).not.toContain("short-pw");
  });

  it("normalizes email and defaults the name", () => {
    const r = parseAdminSeedConfig({ SEED_ADMIN_EMAIL: "  Admin@Example.COM ", SEED_ADMIN_PASSWORD: "0123456789" });
    expect(r).toEqual({ kind: "ok", config: { email: "admin@example.com", password: "0123456789", name: "Super Admin" } });
    const named = parseAdminSeedConfig({ SEED_ADMIN_EMAIL: "a@b.co", SEED_ADMIN_PASSWORD: "0123456789", SEED_ADMIN_NAME: " Boss " });
    expect(named.kind === "ok" && named.config.name).toBe("Boss");
  });
});

describe("decideAdminSeed", () => {
  it("skips when the email exists", () => {
    expect(decideAdminSeed({ emailExists: true, activeSuperAdminExists: false })).toBe("skip-exists");
    expect(decideAdminSeed({ emailExists: true, activeSuperAdminExists: true })).toBe("skip-exists");
  });
  it("skips when another active super_admin exists", () => {
    expect(decideAdminSeed({ emailExists: false, activeSuperAdminExists: true })).toBe("skip-has-admin");
  });
  it("creates otherwise", () => {
    expect(decideAdminSeed({ emailExists: false, activeSuperAdminExists: false })).toBe("create");
  });
});
