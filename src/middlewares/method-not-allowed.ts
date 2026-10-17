import type { Router } from "express";
import { HTTP_STATUS, STATUS_MESSAGE } from "../config/constants";
import { ApiError } from "../utils/api-error";

/** Minimal view of Express's router stack (not part of the public typings). */
type RouteLayer = { route?: { path: string; methods: Record<string, boolean> } };

/**
 * Call as the LAST statement of a router file. For every registered path it appends a catch-all
 * that answers 405 + `Allow` when the path exists but the method does not.
 */
export function addMethodNotAllowed(router: Router) {
  const allowedByPath = new Map<string, Set<string>>();
  for (const layer of router.stack as unknown as RouteLayer[]) {
    if (!layer.route) continue;
    const set = allowedByPath.get(layer.route.path) ?? new Set<string>();
    for (const [method, on] of Object.entries(layer.route.methods))
      if (on) set.add(method.toUpperCase());
    allowedByPath.set(layer.route.path, set);
  }
  for (const [path, methods] of allowedByPath) {
    if (methods.has("GET")) methods.add("HEAD");
    methods.add("OPTIONS");
    const allow = [...methods].sort().join(", ");
    router.all(path, (req, res, next) => {
      res.set("Allow", allow);
      if (req.method === "OPTIONS")
        return void res.status(HTTP_STATUS.NO_CONTENT).end();
      next(
        new ApiError(
          HTTP_STATUS.METHOD_NOT_ALLOWED,
          "METHOD_NOT_ALLOWED",
          STATUS_MESSAGE[HTTP_STATUS.METHOD_NOT_ALLOWED],
        ),
      );
    });
  }
}
