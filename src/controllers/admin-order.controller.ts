import type { Request, Response } from "express";
import {
  validatedBody,
  validatedParams,
  validatedQuery,
} from "../middlewares/validate";
import * as orderService from "../services/order.service";
import { ok } from "../utils/response";
import type {
  AdminOrdersQuery,
  CancelBody,
  TrackingBody,
} from "../validators/admin.validator";
import type { IdParams } from "../validators/common.validator";

export async function list(_req: Request, res: Response) {
  const { data, meta } = await orderService.listAdmin(
    validatedQuery<AdminOrdersQuery>(res),
  );
  ok(res, data, meta);
}
export async function get(_req: Request, res: Response) {
  ok(res, await orderService.getAdmin(validatedParams<IdParams>(res).id));
}
export async function cancel(req: Request, res: Response) {
  const { id } = validatedParams<IdParams>(res);
  const { reason } = validatedBody<CancelBody>(req);
  ok(res, await orderService.cancel(req.user!.id, id, reason));
}
export async function tracking(req: Request, res: Response) {
  const { id } = validatedParams<IdParams>(res);
  const { trackingProvider, trackingNo } = validatedBody<TrackingBody>(req);
  ok(
    res,
    await orderService.setTracking(
      req.user!.id,
      id,
      trackingProvider,
      trackingNo,
    ),
  );
}
