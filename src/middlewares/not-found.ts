import type { Request, Response } from "express";

export function notFound(_req: Request, res: Response) {
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "ไม่พบเส้นทางที่ร้องขอ" } });
}
