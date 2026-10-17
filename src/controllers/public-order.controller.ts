import type { Request, Response } from "express";
import {
  validatedBody,
  validatedParams,
  validatedQuery,
} from "../middlewares/validate";
import * as orderService from "../services/order.service";
import * as slipService from "../services/slip.service";
import { created, ok } from "../utils/response";
import type {
  OrderNoParams,
  SlugParams,
} from "../validators/common.validator";
import type {
  CreateOrderInput,
  FindOrderQuery,
  SlipBody,
} from "../validators/order.validator";

export async function create(req: Request, res: Response) {
  created(
    res,
    await orderService.createOrder(
      validatedParams<SlugParams>(res).slug,
      validatedBody<CreateOrderInput>(req),
    ),
  );
}
export async function find(_req: Request, res: Response) {
  ok(
    res,
    await orderService.findPublic(
      validatedParams<OrderNoParams>(res).orderNo,
      validatedQuery<FindOrderQuery>(res).phoneLast4,
    ),
  );
}
export async function uploadSlip(req: Request, res: Response) {
  ok(
    res,
    await slipService.submitSlip(
      validatedParams<OrderNoParams>(res).orderNo,
      validatedBody<SlipBody>(req).phoneLast4,
      req.file,
    ),
  );
}
