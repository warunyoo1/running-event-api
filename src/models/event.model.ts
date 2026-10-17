import { Schema, model, type InferSchemaType } from "mongoose";
import { eventCategories, eventStatuses, eventThemes } from "../config/constants";
import { cleanJson } from "./plugins";

const eventSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    subtitle: { type: String, default: "" },
    description: { type: String, default: "" },
    date: { type: String, required: true }, // YYYY-MM-DD
    venue: { type: String, required: true },
    province: { type: String, default: "" },
    category: { type: String, enum: eventCategories, default: "road" },
    theme: { type: String, enum: eventThemes, default: "orange" },
    status: { type: String, enum: eventStatuses, default: "draft" },
    registrationEnds: { type: String }, // YYYY-MM-DD
    organizer: { type: String, default: "" },
    refundPolicy: { type: String },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);
eventSchema.index({ slug: 1 }, { unique: true, name: "slug_unique" });
eventSchema.index({ status: 1, date: 1 });
cleanJson(eventSchema);

export type EventDoc = InferSchemaType<typeof eventSchema>;
export const EventModel = model("Event", eventSchema);
