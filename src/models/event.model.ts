import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import {
  EVENT_IMAGE_ALT_MAX,
  EVENT_IMAGE_MIMES,
  eventCategories,
  eventImageKinds,
  eventStatuses,
  eventThemes,
} from "../config/constants";
import { cleanJson } from "./plugins";

/** Event image (subdocument; `_id` is the image id). `filename` is server generated and never sent to clients. */
const eventImageSchema = new Schema(
  {
    kind: { type: String, enum: eventImageKinds, required: true },
    filename: { type: String, required: true }, // "<uuid>.<jpg|png|webp>"
    mime: { type: String, enum: EVENT_IMAGE_MIMES, required: true },
    size: { type: Number, required: true }, // bytes
    alt: { type: String, default: "", maxlength: EVENT_IMAGE_ALT_MAX },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

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
    images: { type: [eventImageSchema], default: [] },
  },
  { timestamps: true },
);
eventSchema.index({ slug: 1 }, { unique: true, name: "slug_unique" });
eventSchema.index({ status: 1, date: 1 });
eventSchema.index({ "images._id": 1 }, { name: "image_id" }); // file lookup by image id
cleanJson(eventSchema);

export type EventDoc = InferSchemaType<typeof eventSchema>;
/** A stored image subdocument (`filename` never leaves the server). */
export type EventImageDoc = InferSchemaType<typeof eventImageSchema>;
export type EventImageLean = EventImageDoc & { _id: Types.ObjectId };
/** An event as returned by `.lean()`. */
export type EventLean = Omit<EventDoc, "images"> & {
  _id: Types.ObjectId;
  images: EventImageLean[];
};
export const EventModel = model("Event", eventSchema);
