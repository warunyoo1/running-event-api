import type { Request, Response } from "express";
import { validatedQuery } from "../middlewares/validate";
import * as auditLogService from "../services/audit-log.service";
import { ok } from "../utils/response";
import type { AuditLogsQuery } from "../validators/admin.validator";

export async function list(_req: Request, res: Response) {
  const { data, meta } = await auditLogService.list(
    validatedQuery<AuditLogsQuery>(res),
  );
  ok(res, data, meta);
}
