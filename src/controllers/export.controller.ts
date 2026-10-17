import type { Request, Response } from "express";
import * as exportService from "../services/export.service";

function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(csv);
}
export async function orders(_req: Request, res: Response) {
  sendCsv(res, "orders.csv", await exportService.ordersCsv(res.locals.query));
}
export async function participants(_req: Request, res: Response) {
  sendCsv(
    res,
    "participants.csv",
    await exportService.participantsCsv(res.locals.query),
  );
}
export async function fulfillment(_req: Request, res: Response) {
  sendCsv(
    res,
    "fulfillment.csv",
    await exportService.fulfillmentCsv(res.locals.query),
  );
}
