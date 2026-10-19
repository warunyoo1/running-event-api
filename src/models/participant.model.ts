import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { cleanJson } from "./plugins";

const participantSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    raceId: { type: Schema.Types.ObjectId, ref: "Race", required: true },
    raceName: { type: String, required: true },
    price: { type: Number, default: 0 },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    gender: { type: String, required: true },
    birthDate: { type: String, required: true },
    nationality: { type: String, required: true },
    idNumberEnc: { type: String },
    idLast4: { type: String },
    identityReference: { type: String },
    declineIdentity: { type: Boolean, default: false },
    email: { type: String },
    phone: { type: String, required: true },
    medical: { type: String },
    blood: { type: String },
    emergencyName: { type: String },
    emergencyRelation: { type: String },
    emergencyPhone: { type: String },
    province: { type: String, required: true },
    team: { type: String },
    applicantType: { type: String, required: true },
    size: { type: String, required: true },
    bibNo: { type: String },
    collected: { type: Boolean, default: false },
    collectedAt: { type: Date },
  },
  { timestamps: true },
);
participantSchema.index({ identityReference: 1 }, { unique: true, partialFilterExpression: { identityReference: { $type: "string" } } });
participantSchema.index({ orderId: 1 });
participantSchema.index({ eventId: 1, raceId: 1 });
participantSchema.index(
  { eventId: 1, bibNo: 1 },
  { unique: true, name: "event_bib_unique", partialFilterExpression: { bibNo: { $type: "string" } } },
);
cleanJson(participantSchema, ["idNumberEnc"]);

export type ParticipantDoc = InferSchemaType<typeof participantSchema>;
/** A participant as returned by `.lean()`. */
export type ParticipantLean = ParticipantDoc & { _id: Types.ObjectId };
export const Participant = model("Participant", participantSchema);

