import { Schema, model, type InferSchemaType } from "mongoose";
import { cleanJson } from "./plugins";

const raceSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    quota: { type: Number, required: true, min: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    start: { type: String },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
raceSchema.index({ eventId: 1, name: 1 }, { unique: true, name: "event_race_unique" });
raceSchema.index({ eventId: 1, sortOrder: 1 });
cleanJson(raceSchema);

export type RaceDoc = InferSchemaType<typeof raceSchema>;
export const Race = model("Race", raceSchema);
