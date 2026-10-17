import type { Request, Response } from "express";
import mongoose from "mongoose";

export function check(_req: Request, res: Response) {
  const up = mongoose.connection.readyState === 1;
  res
    .status(up ? 200 : 503)
    .json({ data: { status: up ? "ok" : "unavailable" } });
}
