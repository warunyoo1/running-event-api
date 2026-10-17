import type { Schema } from "mongoose";

/** toJSON: expose `id`, hide `_id`/`__v` and any listed private fields. */
export function cleanJson(schema: Schema, hidden: string[] = []) {
  schema.set("toJSON", {
    virtuals: false,
    versionKey: false,
    transform(_doc, ret: Record<string, unknown>) {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.__v;
      for (const key of hidden) delete ret[key];
      return ret;
    },
  });
}
