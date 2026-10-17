import { Schema, model } from "mongoose";

const auditSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

export const AuditLog = model("AuditLog", auditSchema);
