import type { Request, Response } from "express";
import { validatedQuery } from "../middlewares/validate";
import * as dashboardService from "../services/dashboard.service";
import { ok } from "../utils/response";
import type { DashboardQuery } from "../validators/admin.validator";

export async function get(_req: Request, res: Response) {
  const { eventId } = validatedQuery<DashboardQuery>(res);
  ok(res, await dashboardService.get(eventId));
}
