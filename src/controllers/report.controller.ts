import type { Request, Response } from "express";
import * as reportService from "../services/report.service";
import { ok } from "../utils/response";

export async function summary(_req: Request, res: Response) {
  ok(res, await reportService.summary(res.locals.query));
}
export async function shirtSizes(_req: Request, res: Response) {
  ok(res, await reportService.shirtSizeReport(res.locals.query));
}
