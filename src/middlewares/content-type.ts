import type { NextFunction, Request, Response } from "express";
import { HTTP_STATUS } from "../config/constants";
import { ApiError } from "../utils/api-error";

const WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** 415 when a request carries a body of the wrong type. `req.is` returns null when there is no body. */
export function requireContentType(kind: "json" | "multipart") {
  const mime = kind === "json" ? "application/json" : "multipart/form-data";
  return (req: Request, _res: Response, next: NextFunction) => {
    const hasBody =
      req.headers["transfer-encoding"] !== undefined ||
      Number(req.headers["content-length"] ?? 0) > 0;
    if (hasBody && WITH_BODY.has(req.method) && req.is(mime) === false)
      return next(
        new ApiError(
          HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
          "UNSUPPORTED_MEDIA_TYPE",
          `ต้องส่งข้อมูลเป็น ${mime}`,
        ),
      );
    next();
  };
}
