import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { cleanJson } from "./plugins";

export const paymentStatuses = ["submitted", "approved", "rejected", "superseded"] as const;

const paymentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    slipPath: { type: String, required: true },
    slipMime: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: paymentStatuses, default: "submitted" },
    transactionRef: { type: String },
    rejectReason: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);
paymentSchema.index({ orderId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: 1 });
cleanJson(paymentSchema, ["slipPath"]);

export type PaymentDoc = InferSchemaType<typeof paymentSchema>;
/** A payment as returned by `.lean()`. */
export type PaymentLean = PaymentDoc & { _id: Types.ObjectId };
export const Payment = model("Payment", paymentSchema);
