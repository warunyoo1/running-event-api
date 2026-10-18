import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { ORDER_NOTE_MAX } from "../config/constants";
import { cleanJson } from "./plugins";

/** Internal, append-only note on an order (kept out of the Order document so list rows stay unchanged). */
const orderNoteSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: ORDER_NOTE_MAX },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
orderNoteSchema.index({ orderId: 1, createdAt: 1 });
// User hard-delete reference check.
orderNoteSchema.index({ authorId: 1 });
cleanJson(orderNoteSchema);

export type OrderNoteDoc = InferSchemaType<typeof orderNoteSchema>;
/** A note as returned by `.lean()`. */
export type OrderNoteLean = OrderNoteDoc & { _id: Types.ObjectId };
export const OrderNote = model("OrderNote", orderNoteSchema);
