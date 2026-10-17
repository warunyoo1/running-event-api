import type { NextFunction, Request, Response } from "express";
import { buildEnvelope } from "../utils/response";

/** Wraps every `res.json` body in the standard envelope. `res.send`/`sendFile` (CSV, slips) are untouched. */
export function responseEnvelope(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  const json = res.json.bind(res);
  res.json = (body) =>
    json(buildEnvelope(res.statusCode, body, res.locals.responseMessage));
  next();
}
