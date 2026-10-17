import type { ClientSession } from "mongoose";
import { AuditLog } from "../models";

export async function audit(
  userId: string | undefined,
  action: string,
  entity: string,
  entityId: string | undefined,
  meta?: Record<string, unknown>,
  session?: ClientSession,
) {
  try {
    await AuditLog.create(
      [{ userId, action, entity, entityId, meta }],
      session ? { session } : undefined,
    );
  } catch (err) {
    if (session) throw err;
    console.error("audit log failed", err);
  }
}
