import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import type { AuditLogLean } from "../src/models/audit-log.model";
import { auditLogsQuery } from "../src/validators/admin.validator";
import { toAuditLogView } from "../src/views/audit-log.view";

const id = new Types.ObjectId().toHexString();

describe("auditLogsQuery", () => {
  it("defaults to page 1 / 20 with no filters", () => {
    const q = auditLogsQuery.parse({});
    expect(q).toMatchObject({ page: 1, pageSize: 20 });
    expect(q.userId).toBeUndefined();
    expect(q.entity).toBeUndefined();
  });

  it("accepts every filter and treats empty strings as missing", () => {
    const q = auditLogsQuery.parse({
      userId: id,
      action: "order.cancel",
      entity: "Order",
      entityId: id,
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(q).toMatchObject({ userId: id, action: "order.cancel", entity: "Order", entityId: id });
    const empty = auditLogsQuery.parse({ userId: "", action: "", entity: "", entityId: "", from: "", to: "" });
    expect(empty.entity).toBeUndefined();
    expect(empty.from).toBeUndefined();
  });

  it("rejects a bad entity, object id or date", () => {
    expect(auditLogsQuery.safeParse({ entity: "Race" }).success).toBe(false);
    expect(auditLogsQuery.safeParse({ userId: "nope" }).success).toBe(false);
    expect(auditLogsQuery.safeParse({ entityId: "nope" }).success).toBe(false);
    expect(auditLogsQuery.safeParse({ from: "01/01/2026" }).success).toBe(false);
    expect(auditLogsQuery.safeParse({ to: "2026-1-1" }).success).toBe(false);
  });
});

describe("toAuditLogView", () => {
  const createdAt = new Date("2026-01-01T00:00:00Z");
  const base = {
    _id: new Types.ObjectId(),
    action: "auth.login",
    entity: "User",
    createdAt,
  } as AuditLogLean;

  it("gives null actor, meta and entityId when they are missing", () => {
    expect(toAuditLogView(base, new Map())).toEqual({
      id: String(base._id),
      action: "auth.login",
      entity: "User",
      entityId: null,
      meta: null,
      actor: null,
      createdAt,
    });
  });

  it("resolves the actor and passes meta through", () => {
    const userId = new Types.ObjectId();
    const row = { ...base, userId, entityId: id, meta: { reason: "x" } } as AuditLogLean;
    const view = toAuditLogView(row, new Map([[String(userId), { name: "A", email: "a@x.th" }]]));
    expect(view.actor).toEqual({ id: String(userId), name: "A", email: "a@x.th" });
    expect(view.meta).toEqual({ reason: "x" });
    expect(view.entityId).toBe(id);
  });

  it("has no actor when the user no longer exists", () => {
    const row = { ...base, userId: new Types.ObjectId() } as AuditLogLean;
    expect(toAuditLogView(row, new Map()).actor).toBeNull();
  });
});
