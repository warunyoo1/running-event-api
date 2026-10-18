import type { FilterQuery } from "mongoose";
import { AuditLog, User } from "../models";
import type { AuditLogDoc, AuditLogLean } from "../models/audit-log.model";
import type { PageMeta } from "../types/api";
import { bangkokRange } from "../utils/date-range";
import { pageMeta, skipOf } from "../utils/pagination";
import type { AuditLogsQuery } from "../validators/admin.validator";
import { toAuditLogView, type AuditLogView } from "../views/audit-log.view";

export async function list(
  q: AuditLogsQuery,
): Promise<{ data: AuditLogView[]; meta: PageMeta }> {
  const filter: FilterQuery<AuditLogDoc> = {};
  if (q.userId) filter.userId = q.userId;
  if (q.action) filter.action = q.action;
  if (q.entity) filter.entity = q.entity;
  if (q.entityId) filter.entityId = q.entityId;
  const range = bangkokRange(q.from, q.to);
  if (range) filter.createdAt = range;

  const [rows, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skipOf(q))
      .limit(q.pageSize)
      .lean<AuditLogLean[]>(),
    AuditLog.countDocuments(filter),
  ]);

  const userIds = [
    ...new Set(rows.flatMap((r) => (r.userId ? [String(r.userId)] : []))),
  ];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("name email")
        .lean()
    : [];
  const actors = new Map(users.map((u) => [String(u._id), u]));

  return {
    data: rows.map((r) => toAuditLogView(r, actors)),
    meta: pageMeta(q, total),
  };
}
