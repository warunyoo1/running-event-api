import type { Request, Response } from "express";
import * as participantService from "../services/participant.service";
import { ok } from "../utils/response";

export async function list(_req: Request, res: Response) {
  const { data, meta } = await participantService.list(res.locals.query);
  ok(res, data, meta);
}
export async function patch(req: Request, res: Response) {
  ok(
    res,
    await participantService.patch(
      req.user!.id,
      res.locals.params.id,
      req.body,
    ),
  );
}
