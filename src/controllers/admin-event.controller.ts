import type { Request, Response } from "express";
import { API_PREFIX } from "../config/constants";
import {
  validatedBody,
  validatedParams,
  validatedQuery,
} from "../middlewares/validate";
import * as eventService from "../services/event.service";
import { created, done, ok } from "../utils/response";
import type { IdParams } from "../validators/common.validator";
import type {
  AdminEventsQuery,
  EventBody,
} from "../validators/event.validator";

export async function list(_req: Request, res: Response) {
  const { data, meta } = await eventService.listAdmin(
    validatedQuery<AdminEventsQuery>(res),
  );
  ok(res, data, meta);
}
export async function get(_req: Request, res: Response) {
  ok(res, await eventService.getAdmin(validatedParams<IdParams>(res).id));
}
export async function create(req: Request, res: Response) {
  const event = await eventService.create(
    req.user!.id,
    validatedBody<EventBody>(req),
  );
  created(res, event, {
    location: `${API_PREFIX}/admin/events/${event.id}`,
  });
}
export async function update(req: Request, res: Response) {
  ok(
    res,
    await eventService.update(
      req.user!.id,
      validatedParams<IdParams>(res).id,
      validatedBody<EventBody>(req),
    ),
  );
}
export async function archive(req: Request, res: Response) {
  ok(
    res,
    await eventService.archive(req.user!.id, validatedParams<IdParams>(res).id),
  );
}
export async function restore(req: Request, res: Response) {
  ok(
    res,
    await eventService.restore(req.user!.id, validatedParams<IdParams>(res).id),
  );
}
export async function remove(req: Request, res: Response) {
  await eventService.remove(req.user!.id, validatedParams<IdParams>(res).id);
  done(res, "ลบงานวิ่งแล้ว");
}
