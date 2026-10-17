import type { Request, Response } from "express";
import * as orderService from "../services/order.service";
import * as slipService from "../services/slip.service";
import { created, ok } from "../utils/response";

export async function create(req: Request, res: Response) {
  created(
    res,
    await orderService.createOrder(res.locals.params.slug, req.body),
  );
}
export async function find(_req: Request, res: Response) {
  ok(
    res,
    await orderService.findPublic(
      res.locals.params.orderNo,
      res.locals.query.phoneLast4,
    ),
  );
}
export async function uploadSlip(req: Request, res: Response) {
  ok(
    res,
    await slipService.submitSlip(
      res.locals.params.orderNo,
      req.body.phoneLast4,
      req.file,
    ),
  );
}
