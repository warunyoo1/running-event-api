import type { Request, Response } from "express";
import * as userService from "../services/user.service";
import { created, ok } from "../utils/response";

export async function list(_req: Request, res: Response) {
  ok(res, await userService.list());
}
export async function create(req: Request, res: Response) {
  created(res, await userService.create(req.user!.id, req.body));
}
export async function update(req: Request, res: Response) {
  ok(
    res,
    await userService.update(req.user!.id, res.locals.params.id, req.body),
  );
}
