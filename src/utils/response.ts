import type { Response } from "express";

export type Meta = Record<string, unknown>;

export function ok<T>(res: Response, data: T, meta?: Meta) {
  return res.json(meta ? { data, meta } : { data });
}

export function created<T>(res: Response, data: T) {
  return res.status(201).json({ data });
}
