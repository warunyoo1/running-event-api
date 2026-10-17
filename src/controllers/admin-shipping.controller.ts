import type { Request, Response } from "express";
import * as shippingService from "../services/shipping.service";
import { ok } from "../utils/response";

export async function list(_req: Request, res: Response) {
  const { data, meta } = await shippingService.list(res.locals.query);
  ok(res, data, meta);
}
