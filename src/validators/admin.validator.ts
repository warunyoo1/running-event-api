import { z } from "zod";
import {
  AUDIT_ENTITIES,
  ORDER_NOTE_MAX,
  deliveryMethods,
  orderStatuses,
} from "../config/constants";
import { objectId, optStr, pageQuery } from "./common.validator";
import { validateAddress } from "./order.validator";

const emptyToUndef = (v: unknown) => (v === "" ? undefined : v);
const optObjectId = z.preprocess(emptyToUndef, objectId.optional());
const optDate = z.preprocess(
  emptyToUndef,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
);
const optOrderStatus = z.preprocess(
  emptyToUndef,
  z.enum(orderStatuses).optional(),
);
const withoutPaging = { page: true, pageSize: true } as const;

export const adminOrdersQuery = pageQuery.extend({
  eventId: optObjectId,
  status: optOrderStatus,
  q: optStr,
  from: optDate,
  to: optDate,
});
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuery>;
export const exportOrdersQuery = adminOrdersQuery.omit(withoutPaging);
export type ExportOrdersQuery = z.infer<typeof exportOrdersQuery>;

export const cancelBody = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type CancelBody = z.infer<typeof cancelBody>;

export const trackingBody = z.object({
  trackingProvider: z.string().trim().min(1, "กรุณากรอกขนส่ง").max(100),
  trackingNo: z.string().trim().min(1, "กรุณากรอกเลขพัสดุ").max(100),
});
export type TrackingBody = z.infer<typeof trackingBody>;

export const noteBody = z.object({
  text: z
    .string({ required_error: "กรุณากรอกบันทึก" })
    .trim()
    .min(1, "กรุณากรอกบันทึก")
    .max(ORDER_NOTE_MAX, `บันทึกยาวได้ไม่เกิน ${ORDER_NOTE_MAX} ตัวอักษร`),
});
export type NoteBody = z.infer<typeof noteBody>;

export const noteParams = z.object({ id: objectId, noteId: objectId });
export type NoteParams = z.infer<typeof noteParams>;

// Same maxima as `deliveryShape`; the rules themselves come from `validateAddress` (shared with checkout).
const addressPart = (max: number) =>
  z.string({ required_error: "กรุณากรอกข้อมูล" }).max(max);
export const addressBody = z
  .object({
    street: addressPart(300),
    subdistrict: addressPart(100),
    district: addressPart(100),
    province: addressPart(100),
    postalCode: addressPart(10),
  })
  .superRefine((v, ctx) => {
    for (const [key, message] of Object.entries(validateAddress(v)))
      ctx.addIssue({ code: "custom", path: [key], message });
  });
export type AddressBody = z.infer<typeof addressBody>;

export const approveBody = z.object({
  transactionRef: z
    .string({ required_error: "กรุณากรอกเลขอ้างอิงการโอน" })
    .trim()
    .min(3, "เลขอ้างอิงต้องมีอย่างน้อย 3 ตัวอักษร")
    .max(64)
    .regex(/^[A-Za-z0-9\-_/.]+$/, "เลขอ้างอิงใช้ได้เฉพาะ A-Z a-z 0-9 - _ / ."),
});
export type ApproveBody = z.infer<typeof approveBody>;

export const rejectBody = z.object({
  reason: z
    .string({ required_error: "กรุณากรอกเหตุผล" })
    .trim()
    .min(1, "กรุณากรอกเหตุผล")
    .max(500),
});
export type RejectBody = z.infer<typeof rejectBody>;

export const slipsQuery = pageQuery.extend({
  eventId: optObjectId,
  tab: z.enum(["waiting", "history"]).default("waiting"),
});
export type SlipsQuery = z.infer<typeof slipsQuery>;

export const participantsQuery = pageQuery.extend({
  eventId: optObjectId,
  q: optStr,
  race: optStr,
  status: optOrderStatus,
});
export type ParticipantsQuery = z.infer<typeof participantsQuery>;
export const exportParticipantsQuery = participantsQuery.omit(withoutPaging);
export type ExportParticipantsQuery = z.infer<typeof exportParticipantsQuery>;

export const patchParticipantBody = z
  .object({
    collected: z.boolean().optional(),
    bibNo: z.string().trim().min(1).max(20).nullable().optional(),
  })
  .strict();
export type PatchParticipantBody = z.infer<typeof patchParticipantBody>;

export const shippingQuery = pageQuery.extend({
  eventId: optObjectId,
  q: optStr,
  method: z.preprocess(emptyToUndef, z.enum(deliveryMethods).optional()),
});
export type ShippingQuery = z.infer<typeof shippingQuery>;
export const exportShippingQuery = shippingQuery.omit(withoutPaging);
export type ExportShippingQuery = z.infer<typeof exportShippingQuery>;

export const auditLogsQuery = pageQuery.extend({
  userId: optObjectId,
  action: optStr,
  entity: z.preprocess(emptyToUndef, z.enum(AUDIT_ENTITIES).optional()),
  entityId: optObjectId,
  from: optDate,
  to: optDate,
});
export type AuditLogsQuery = z.infer<typeof auditLogsQuery>;

export const dashboardQuery = z.object({ eventId: optObjectId });
export type DashboardQuery = z.infer<typeof dashboardQuery>;

export const summaryQuery = z.object({
  eventId: optObjectId,
  from: optDate,
  to: optDate,
});
export type SummaryQuery = z.infer<typeof summaryQuery>;

export const shirtSizesQuery = z.object({
  eventId: optObjectId,
  status: z.preprocess(emptyToUndef, z.enum(orderStatuses).default("paid")),
});
export type ShirtSizesQuery = z.infer<typeof shirtSizesQuery>;
