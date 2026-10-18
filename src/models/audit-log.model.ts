import { Schema, model, type InferSchemaType, type Types } from "mongoose";

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
auditSchema.index({ createdAt: -1 });
auditSchema.index({ userId: 1, createdAt: -1 });
auditSchema.index({ action: 1, createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditSchema>;
/** An audit row as returned by `.lean()`. */
export type AuditLogLean = AuditLogDoc & { _id: Types.ObjectId };
export const AuditLog = model("AuditLog", auditSchema);
