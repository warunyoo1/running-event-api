import type { Request, Response } from "express";
import { validatedQuery } from "../middlewares/validate";
import * as reportService from "../services/report.service";
import { ok } from "../utils/response";
import type {
  ShirtSizesQuery,
  SummaryQuery,
} from "../validators/admin.validator";

export async function summary(_req: Request, res: Response) {
  ok(res, await reportService.summary(validatedQuery<SummaryQuery>(res)));
}
export async function shirtSizes(_req: Request, res: Response) {
  ok(
    res,
    await reportService.shirtSizeReport(validatedQuery<ShirtSizesQuery>(res)),
  );
}
