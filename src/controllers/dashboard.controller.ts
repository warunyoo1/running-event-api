import type { Request, Response } from "express";
import * as dashboardService from "../services/dashboard.service";
import { ok } from "../utils/response";

export async function get(_req: Request, res: Response) {
  ok(res, await dashboardService.get(res.locals.query.eventId));
}
