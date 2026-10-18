import { AuditLog } from "../models";

export async function audit(
  userId: string | undefined,
  action: string,
  entity: string,
  entityId: string | undefined,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await AuditLog.create({ userId, action, entity, entityId, meta });
  } catch (err) {
    console.error("audit log failed", err);
  }
}
