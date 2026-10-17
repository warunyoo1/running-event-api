import type { Request, Response } from "express";
import {
  validatedBody,
  validatedParams,
  validatedQuery,
} from "../middlewares/validate";
import * as participantService from "../services/participant.service";
import { ok } from "../utils/response";
import type {
  ParticipantsQuery,
  PatchParticipantBody,
} from "../validators/admin.validator";
import type { IdParams } from "../validators/common.validator";

export async function list(_req: Request, res: Response) {
  const { data, meta } = await participantService.list(
    validatedQuery<ParticipantsQuery>(res),
  );
  ok(res, data, meta);
}
export async function patch(req: Request, res: Response) {
  ok(
    res,
    await participantService.patch(
      req.user!.id,
      validatedParams<IdParams>(res).id,
      validatedBody<PatchParticipantBody>(req),
    ),
  );
}
