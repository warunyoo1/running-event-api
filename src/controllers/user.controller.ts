import type { Request, Response } from "express";
import { validatedBody, validatedParams } from "../middlewares/validate";
import * as userService from "../services/user.service";
import { created, done, ok } from "../utils/response";
import type { IdParams } from "../validators/common.validator";
import type {
  CreateUserBody,
  UpdateUserBody,
} from "../validators/user.validator";

export async function list(_req: Request, res: Response) {
  ok(res, await userService.list());
}
export async function create(req: Request, res: Response) {
  created(
    res,
    await userService.create(req.user!.id, validatedBody<CreateUserBody>(req)),
  );
}
export async function remove(req: Request, res: Response) {
  await userService.remove(req.user!.id, validatedParams<IdParams>(res).id);
  done(res, "ลบผู้ใช้แล้ว");
}
export async function update(req: Request, res: Response) {
  ok(
    res,
    await userService.update(
      req.user!.id,
      validatedParams<IdParams>(res).id,
      validatedBody<UpdateUserBody>(req),
    ),
  );
}
