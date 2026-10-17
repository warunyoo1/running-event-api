import type { Request, Response } from "express";
import * as eventService from "../services/event.service";
import { created, ok } from "../utils/response";

export async function list(_req: Request, res: Response) {
  const { data, meta } = await eventService.listAdmin(res.locals.query);
  ok(res, data, meta);
}
export async function get(_req: Request, res: Response) {
  ok(res, await eventService.getAdmin(res.locals.params.id));
}
export async function create(req: Request, res: Response) {
  created(res, await eventService.create(req.user!.id, req.body));
}
export async function update(req: Request, res: Response) {
  ok(
    res,
    await eventService.update(req.user!.id, res.locals.params.id, req.body),
  );
}
