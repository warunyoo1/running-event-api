import type { Request, Response } from "express";
import * as orderService from "../services/order.service";
import { ok } from "../utils/response";

export async function list(_req: Request, res: Response) {
  const { data, meta } = await orderService.listAdmin(res.locals.query);
  ok(res, data, meta);
}
export async function get(_req: Request, res: Response) {
  ok(res, await orderService.getAdmin(res.locals.params.id));
}
export async function cancel(req: Request, res: Response) {
  ok(
    res,
    await orderService.cancel(
      req.user!.id,
      res.locals.params.id,
      req.body.reason,
    ),
  );
}
export async function tracking(req: Request, res: Response) {
  ok(
    res,
    await orderService.setTracking(
      req.user!.id,
      res.locals.params.id,
      req.body.trackingProvider,
      req.body.trackingNo,
    ),
  );
}
