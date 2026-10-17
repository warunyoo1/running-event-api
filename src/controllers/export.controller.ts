import type { Request, Response } from "express";
import { validatedQuery } from "../middlewares/validate";
import * as exportService from "../services/export.service";
import type {
  ExportOrdersQuery,
  ExportParticipantsQuery,
  ExportShippingQuery,
} from "../validators/admin.validator";

function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(csv);
}

export async function orders(_req: Request, res: Response) {
  sendCsv(
    res,
    "orders.csv",
    await exportService.ordersCsv(validatedQuery<ExportOrdersQuery>(res)),
  );
}
export async function participants(_req: Request, res: Response) {
  sendCsv(
    res,
    "participants.csv",
    await exportService.participantsCsv(
      validatedQuery<ExportParticipantsQuery>(res),
    ),
  );
}
export async function fulfillment(_req: Request, res: Response) {
  sendCsv(
    res,
    "fulfillment.csv",
    await exportService.fulfillmentCsv(validatedQuery<ExportShippingQuery>(res)),
  );
}
