import type { NextFunction, Request, Response } from "express";
import {
  validatedBody,
  validatedParams,
  validatedQuery,
} from "../middlewares/validate";
import * as reviewService from "../services/review.service";
import * as slipService from "../services/slip.service";
import { ApiError } from "../utils/api-error";
import { ok } from "../utils/response";
import type {
  ApproveBody,
  RejectBody,
  SlipsQuery,
} from "../validators/admin.validator";
import type { IdParams } from "../validators/common.validator";

export async function list(_req: Request, res: Response) {
  const { data, meta } = await reviewService.listSlips(
    validatedQuery<SlipsQuery>(res),
  );
  ok(res, data, meta);
}

export async function file(_req: Request, res: Response, next: NextFunction) {
  const { id } = validatedParams<IdParams>(res);
  const { fullPath, mime } = await slipService.getSlipFile(id);
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  res.sendFile(fullPath, (err) => {
    // The DB row exists but the file is gone (or unreadable).
    if (err && !res.headersSent)
      next(ApiError.notFound("ไม่พบไฟล์สลิป", "SLIP_NOT_FOUND"));
  });
}

export async function approve(req: Request, res: Response) {
  const { id } = validatedParams<IdParams>(res);
  const { transactionRef } = validatedBody<ApproveBody>(req);
  ok(res, await reviewService.approve(req.user!.id, id, transactionRef));
}

export async function reject(req: Request, res: Response) {
  const { id } = validatedParams<IdParams>(res);
  const { reason } = validatedBody<RejectBody>(req);
  ok(res, await reviewService.reject(req.user!.id, id, reason));
}
