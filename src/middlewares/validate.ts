import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ApiError } from "../utils/api-error";
import { flattenZod } from "../validators/common.validator";

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

/**
 * Validates request parts with Zod. Parsed body replaces req.body;
 * parsed query/params are available on res.locals.query / res.locals.params.
 */
export function validate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    const fields: Record<string, string> = {};
    const run = (
      schema: ZodTypeAny | undefined,
      value: unknown,
      prefix: string,
      assign: (v: unknown) => void,
      notFoundOnFail = false,
    ) => {
      if (!schema) return;
      const result = schema.safeParse(value ?? {});
      if (result.success) return assign(result.data);
      if (notFoundOnFail) throw ApiError.notFound();
      for (const [k, v] of Object.entries(flattenZod(result.error)))
        fields[prefix ? `${prefix}.${k}` : k] = v;
    };
    try {
      run(schemas.params, req.params, "", (v) => (res.locals.params = v), true);
      run(schemas.query, req.query, "", (v) => (res.locals.query = v));
      run(schemas.body, req.body, "", (v) => (req.body = v));
    } catch (err) {
      return next(err);
    }
    if (Object.keys(fields).length) return next(ApiError.validation(fields));
    next();
  };
}
