import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { TIME_HHMM } from "../config/constants";
import { cleanJson } from "./plugins";

const integer = { validator: Number.isInteger, message: "{PATH} must be an integer" };

// Mirrors validators/event.validator.ts raceBody. Mongoose only enforces these on create/save;
// `reserved` is changed with $inc, so its bounds are guarded in the update filters (services/order/order-quota.ts).
const raceSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0, validate: integer },
    quota: { type: Number, required: true, min: 1, validate: integer },
    reserved: { type: Number, default: 0, min: 0 },
    start: { type: String, match: TIME_HHMM },
    prizes: { type: [new Schema({ rank: { type: Number, required: true, min: 1, max: 100, validate: integer }, amount: { type: Number, required: true, min: 0, validate: integer }, trophy: { type: Boolean, default: false } }, { _id: false })], default: undefined },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
raceSchema.index({ eventId: 1, name: 1 }, { unique: true, name: "event_race_unique" });
raceSchema.index({ eventId: 1, sortOrder: 1 });
cleanJson(raceSchema);

export type RaceDoc = InferSchemaType<typeof raceSchema>;
/** A race as returned by `.lean()`. */
export type RaceLean = RaceDoc & { _id: Types.ObjectId };
export const Race = model("Race", raceSchema);
