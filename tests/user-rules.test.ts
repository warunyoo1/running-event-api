import { describe, expect, it } from "vitest";
import { resolveError } from "../src/middlewares/error-handler";
import {
  canHardDelete,
  violatesSelfGuard,
} from "../src/services/user.service";
import { updateUserBody } from "../src/validators/user.validator";

describe("updateUserBody email", () => {
  it("trims and lowercases a valid email", () => {
    const r = updateUserBody.parse({ email: "  Foo@Example.COM " });
    expect(r.email).toBe("foo@example.com");
  });
  it("rejects a bad email", () => {
    expect(updateUserBody.safeParse({ email: "nope" }).success).toBe(false);
  });
  it("still rejects unknown keys", () => {
    expect(updateUserBody.safeParse({ mustChangePassword: false }).success).toBe(
      false,
    );
  });
});

describe("canHardDelete", () => {
  const base = { self: false, active: false, hasHistory: false };
  it("allows an inactive, unreferenced, other user", () => {
    expect(canHardDelete(base)).toEqual({ ok: true });
  });
  it("blocks self before anything else", () => {
    expect(
      canHardDelete({ self: true, active: true, hasHistory: true }),
    ).toEqual({ ok: false, reason: "self" });
  });
  it("blocks active before history", () => {
    expect(
      canHardDelete({ ...base, active: true, hasHistory: true }),
    ).toEqual({ ok: false, reason: "active" });
  });
  it("blocks history", () => {
    expect(canHardDelete({ ...base, hasHistory: true })).toEqual({
      ok: false,
      reason: "history",
    });
  });
});

describe("violatesSelfGuard", () => {
  const user = { role: "super_admin" };
  it("blocks self deactivation", () => {
    expect(violatesSelfGuard("a", "a", user, { active: false })).toBe(true);
  });
  it("blocks self role change", () => {
    expect(violatesSelfGuard("a", "a", user, { role: "viewer" })).toBe(true);
  });
  it("allows self edits that keep role and status", () => {
    expect(violatesSelfGuard("a", "a", user, {})).toBe(false);
    expect(violatesSelfGuard("a", "a", user, { active: true })).toBe(false);
    expect(violatesSelfGuard("a", "a", user, { role: "super_admin" })).toBe(
      false,
    );
  });
  it("allows changes to other users", () => {
    expect(
      violatesSelfGuard("a", "b", user, { active: false, role: "viewer" }),
    ).toBe(false);
  });
});

describe("resolveError", () => {
  it("maps E11000 email_unique to EMAIL_TAKEN 409", () => {
    const r = resolveError({
      code: 11000,
      message: "E11000 duplicate key error index: email_unique dup key",
    });
    expect(r.status).toBe(409);
    expect(r.code).toBe("EMAIL_TAKEN");
  });
});
