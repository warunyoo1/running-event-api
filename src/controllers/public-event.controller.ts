import type { Request, Response } from "express";
import { validatedParams, validatedQuery } from "../middlewares/validate";
import * as eventService from "../services/event.service";
import { ok } from "../utils/response";
import type { SlugParams } from "../validators/common.validator";
import type { PublicEventsQuery } from "../validators/event.validator";

export async function list(_req: Request, res: Response) {
  ok(res, await eventService.listPublic(validatedQuery<PublicEventsQuery>(res)));
}
export async function detail(_req: Request, res: Response) {
  ok(
    res,
    await eventService.getPublicBySlug(validatedParams<SlugParams>(res).slug),
  );
}
