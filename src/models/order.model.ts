import { Schema, model, type InferSchemaType } from "mongoose";
import { deliveryMethods, orderStatuses } from "../config/constants";
import { cleanJson } from "./plugins";

const orderSchema = new Schema(
  {
    orderNo: { type: String, required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    contactName: { type: String, required: true },
    contactPhone: { type: String, required: true },
    contactEmail: { type: String },
    delivery: { type: String, enum: deliveryMethods, required: true },
    address: {
      street: String,
      subdistrict: String,
      district: String,
      province: String,
      postalCode: String,
    },
    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: orderStatuses, default: "pending" },
    expiresAt: { type: Date },
    trackingProvider: { type: String },
    trackingNo: { type: String },
    cancelReason: { type: String },
    rejectionReason: { type: String },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    transactionRef: { type: String },
    paidAt: { type: Date },
    slipUploadedAt: { type: Date },
    raceCounts: [{ _id: false, raceId: { type: Schema.Types.ObjectId, ref: "Race" }, count: Number }],
    // Guards the exactly-once quota release. Old documents lack it, so every guard uses { $ne: true }.
    quotaReleased: { type: Boolean, default: false },
  },
  { timestamps: true },
);
orderSchema.index({ orderNo: 1 }, { unique: true, name: "orderNo_unique" });
orderSchema.index({ eventId: 1, status: 1, createdAt: -1 });
orderSchema.index({ status: 1, expiresAt: 1 });
orderSchema.index({ status: 1, slipUploadedAt: 1 });
orderSchema.index({ contactPhone: 1 });
orderSchema.index(
  { transactionRef: 1 },
  {
    unique: true,
    name: "paid_transactionRef_unique",
    partialFilterExpression: { status: "paid", transactionRef: { $type: "string" } },
  },
);
cleanJson(orderSchema);

export type OrderDoc = InferSchemaType<typeof orderSchema>;
export const Order = model("Order", orderSchema);
