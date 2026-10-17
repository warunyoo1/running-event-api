import type { Request, Response } from "express";
import { validatedQuery } from "../middlewares/validate";
import * as shippingService from "../services/shipping.service";
import { ok } from "../utils/response";
import type { ShippingQuery } from "../validators/admin.validator";

export async function list(_req: Request, res: Response) {
  const { data, meta } = await shippingService.list(
    validatedQuery<ShippingQuery>(res),
  );
  ok(res, data, meta);
}
