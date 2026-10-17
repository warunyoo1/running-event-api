import type { Request, Response } from "express";
import mongoose from "mongoose";
import { HTTP_STATUS } from "../config/constants";

export function check(_req: Request, res: Response) {
  const up = mongoose.connection.readyState === 1;
  res
    .status(up ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE)
    .json({ data: { status: up ? "ok" : "unavailable" } });
}
