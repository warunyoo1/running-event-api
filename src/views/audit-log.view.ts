import type { AuditLogLean } from "../models/audit-log.model";

export interface AuditActorView {
  id: string;
  name: string;
  email: string;
}

export interface AuditLogView {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  actor: AuditActorView | null;
  createdAt: Date;
}

/** `actors` maps user id to the user; a missing entry (deleted user, system action) gives `actor: null`. */
export const toAuditLogView = (
  row: AuditLogLean,
  actors: ReadonlyMap<string, { name: string; email: string }>,
): AuditLogView => {
  const userId = row.userId ? String(row.userId) : null;
  const user = userId ? actors.get(userId) : undefined;
  const meta: unknown = row.meta;
  return {
    id: String(row._id),
    action: row.action,
    entity: row.entity,
    entityId: row.entityId ?? null,
    meta:
      meta !== null && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : null,
    actor: userId && user ? { id: userId, name: user.name, email: user.email } : null,
    createdAt: row.createdAt,
  };
};
