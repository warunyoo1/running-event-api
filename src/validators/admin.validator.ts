import { z } from "zod";
import { orderStatuses } from "../config/constants";
import { objectId, optStr, pageQuery } from "./common.validator";

const emptyToUndef = (v: unknown) => (v === "" ? undefined : v);
const optObjectId = z.preprocess(emptyToUndef, objectId.optional());
const optDate = z.preprocess(
  emptyToUndef,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
);

export const adminOrdersQuery = pageQuery.extend({
  eventId: optObjectId,
  status: z.preprocess(emptyToUndef, z.enum(orderStatuses).optional()),
  q: optStr,
  from: optDate,
  to: optDate,
});
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuery>;
export const exportOrdersQuery = adminOrdersQuery.omit({
  page: true,
  pageSize: true,
});

export const cancelBody = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const trackingBody = z.object({
  trackingProvider: z.string().trim().min(1, "กรุณากรอกขนส่ง").max(100),
  trackingNo: z.string().trim().min(1, "กรุณากรอกเลขพัสดุ").max(100),
});

export const approveBody = z.object({
  transactionRef: z
    .string({ required_error: "กรุณากรอกเลขอ้างอิงการโอน" })
    .trim()
    .min(3, "เลขอ้างอิงต้องมีอย่างน้อย 3 ตัวอักษร")
    .max(64)
    .regex(/^[A-Za-z0-9\-_/.]+$/, "เลขอ้างอิงใช้ได้เฉพาะ A-Z a-z 0-9 - _ / ."),
});

export const rejectBody = z.object({
  reason: z
    .string({ required_error: "กรุณากรอกเหตุผล" })
    .trim()
    .min(1, "กรุณากรอกเหตุผล")
    .max(500),
});

export const slipsQuery = pageQuery.extend({
  eventId: optObjectId,
  tab: z.enum(["waiting", "history"]).default("waiting"),
});

export const participantsQuery = pageQuery.extend({
  eventId: optObjectId,
  q: optStr,
  race: optStr,
  status: z.preprocess(emptyToUndef, z.enum(orderStatuses).optional()),
});
export const exportParticipantsQuery = participantsQuery.omit({
  page: true,
  pageSize: true,
});

export const patchParticipantBody = z
  .object({
    collected: z.boolean().optional(),
    bibNo: z.string().trim().min(1).max(20).nullable().optional(),
  })
  .strict();

export const shippingQuery = pageQuery.extend({
  eventId: optObjectId,
  method: z.preprocess(emptyToUndef, z.enum(["pickup", "shipping"]).optional()),
});
export const exportShippingQuery = shippingQuery.omit({
  page: true,
  pageSize: true,
});

export const dashboardQuery = z.object({ eventId: optObjectId });

export const summaryQuery = z.object({
  eventId: optObjectId,
  from: optDate,
  to: optDate,
});
export const shirtSizesQuery = z.object({
  eventId: optObjectId,
  status: z.preprocess(emptyToUndef, z.enum(orderStatuses).default("paid")),
});
