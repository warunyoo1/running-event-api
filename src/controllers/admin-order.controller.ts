import type { Request, Response } from "express";
import {
  validatedBody,
  validatedParams,
  validatedQuery,
} from "../middlewares/validate";
import * as orderService from "../services/order.service";
import { created, ok } from "../utils/response";
import type {
  AddressBody,
  AdminOrdersQuery,
  CancelBody,
  NoteBody,
  NoteParams,
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

export async function addNote(req: Request, res: Response) {
  const { id } = validatedParams<IdParams>(res);
  const { text } = validatedBody<NoteBody>(req);
  created(res, await orderService.addNote(req.user!, id, text));
}
export async function removeNote(req: Request, res: Response) {
  const { id, noteId } = validatedParams<NoteParams>(res);
  ok(res, await orderService.removeNote(req.user!, id, noteId));
}
export async function address(req: Request, res: Response) {
  const { id } = validatedParams<IdParams>(res);
  ok(
    res,
    await orderService.updateAddress(
      req.user!.id,
      id,
      validatedBody<AddressBody>(req),
    ),
  );
}