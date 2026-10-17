import type { Request, Response } from "express";
import * as reviewService from "../services/review.service";
import * as slipService from "../services/slip.service";
import { ok } from "../utils/response";

export async function list(_req: Request, res: Response) {
  const { data, meta } = await reviewService.listSlips(res.locals.query);
  ok(res, data, meta);
}
export async function file(_req: Request, res: Response) {
  const { fullPath, mime } = await slipService.getSlipFile(
    res.locals.params.id,
  );
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  res.sendFile(fullPath, (err) => {
    if (err && !res.headersSent)
      res
        .status(404)
        .json({ error: { code: "SLIP_NOT_FOUND", message: "ไม่พบไฟล์สลิป" } });
  });
}
export async function approve(req: Request, res: Response) {
  ok(
    res,
    await reviewService.approve(
      req.user!.id,
      res.locals.params.id,
      req.body.transactionRef,
    ),
  );
}
export async function reject(req: Request, res: Response) {
  ok(
    res,
    await reviewService.reject(
      req.user!.id,
      res.locals.params.id,
      req.body.reason,
    ),
  );
}
