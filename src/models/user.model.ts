import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";
import { roles } from "../config/constants";
import { cleanJson } from "./plugins";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: roles, required: true },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);
userSchema.index({ email: 1 }, { unique: true, name: "email_unique" });
cleanJson(userSchema, ["passwordHash"]);

export type UserDoc = InferSchemaType<typeof userSchema>;
/** A user as sent to clients: `toJSON()` of the document (`cleanJson` hides `passwordHash`). */
export type UserJson = ReturnType<HydratedDocument<UserDoc>["toJSON"]>;
export const User = model("User", userSchema);
