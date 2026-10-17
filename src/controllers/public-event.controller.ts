import type { Request, Response } from "express";
import * as eventService from "../services/event.service";
import { ok } from "../utils/response";

export async function list(_req: Request, res: Response) {
  ok(res, await eventService.listPublic(res.locals.query));
}
export async function detail(_req: Request, res: Response) {
  ok(res, await eventService.getPublicBySlug(res.locals.params.slug));
}
