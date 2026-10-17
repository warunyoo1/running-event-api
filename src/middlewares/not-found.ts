import type { Request, Response } from "express";
import { HTTP_STATUS } from "../config/constants";

export function notFound(_req: Request, res: Response) {
  res
    .status(HTTP_STATUS.NOT_FOUND)
    .json({ error: { code: "NOT_FOUND", message: "ไม่พบเส้นทางที่ร้องขอ" } });
}
