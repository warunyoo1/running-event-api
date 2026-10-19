import { z } from "zod";
import {
  MAX_PARTICIPANTS,
  applicantTypes,
  deliveryMethods,
  genders,
  provinces,
  shirtSizes,
} from "../config/constants";
import type { FieldErrors } from "../utils/api-error";
import { bangkokToday } from "../utils/date-range";

export const cleanPhone = (value: string) => value.replace(/[\s()-]/g, "");
const validPhone = (value: string) =>
  /^(?:0\d{8,9}|\+\d{8,15})$/.test(cleanPhone(value));
const validEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** Accept strings/numbers, default to "" (so semantic validation reports friendly errors). */
const str = (max = 500) =>
  z.preprocess(
    (v) =>
      v === undefined || v === null
        ? ""
        : typeof v === "number"
          ? String(v)
          : v,
    z.string().max(max),
  );

export const participantShape = z.object({
  firstName: str(100),
  lastName: str(100),
  gender: str(20),
  birthDay: str(4),
  birthMonth: str(4),
  birthYear: str(6),
  nationality: str(60).default("ไทย"),
  identity: str(30),
  declineIdentity: z.boolean().default(false),
  identityReference: z.union([z.literal(""), z.string().regex(/^RUN-(?:[2-9A-HJ-NP-Z]{10}|[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})$/i).transform(value => value.toUpperCase())]).optional(),
  email: str(200),
  phone: str(30),
  medical: str(500),
  blood: str(10),
  emergencyName: str(100),
  emergencyRelation: str(60),
  emergencyPhone: str(30),
  race: str(100),
  size: str(10),
  province: str(100),
  team: str(100),
  applicantType: str(60).default("บุคคลทั่วไป"),
});
export type ParticipantInput = z.infer<typeof participantShape>;

export const deliveryShape = z.object({
  method: z.enum(deliveryMethods),
  contact: str(100),
  phone: str(30),
  email: str(200),
  street: str(300),
  subdistrict: str(100),
  district: str(100),
  province: str(100),
  postalCode: str(10),
});
export type DeliveryInput = z.infer<typeof deliveryShape>;

// Client-sent amounts/totals are not part of the schema and are stripped.
export const createOrderBody = z.object({
  participants: z
    .array(participantShape)
    .min(1, "ต้องมีผู้สมัครอย่างน้อย 1 คน")
    .max(MAX_PARTICIPANTS, `สมัครได้สูงสุด ${MAX_PARTICIPANTS} คนต่อครั้ง`),
  delivery: deliveryShape,
});
export type CreateOrderInput = z.infer<typeof createOrderBody>;

/** Port of registration.ts validateParticipant. Keys match FieldErrors. */
export function validateParticipant(
  draft: ParticipantInput,
  raceNames: string[],
  today = bangkokToday(),
): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.firstName.trim()) errors.firstName = "กรุณากรอกชื่อ";
  if (!draft.lastName.trim()) errors.lastName = "กรุณากรอกนามสกุล";
  if (!(genders as readonly string[]).includes(draft.gender))
    errors.gender = "กรุณาเลือกเพศ";
  const year = Number(draft.birthYear),
    month = Number(draft.birthMonth),
    day = Number(draft.birthDay);
  const birth = new Date(Date.UTC(year, month - 1, day));
  const dateString = `${draft.birthYear}-${draft.birthMonth.padStart(2, "0")}-${draft.birthDay.padStart(2, "0")}`;
  if (
    !year ||
    !month ||
    !day ||
    year < 1900 ||
    birth.getUTCFullYear() !== year ||
    birth.getUTCMonth() !== month - 1 ||
    birth.getUTCDate() !== day ||
    dateString > today
  )
    errors.birthDate = "กรุณาเลือกวันเกิดที่ถูกต้องและไม่อยู่ในอนาคต";
  if (!draft.nationality) errors.nationality = "กรุณาเลือกสัญชาติ";
  if (!validPhone(draft.phone))
    errors.phone = "กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง เช่น 0812345678";
  if (draft.email.trim() && !validEmail(draft.email))
    errors.email = "กรุณากรอกอีเมลให้ถูกต้อง";
  if (draft.emergencyPhone.trim() && !validPhone(draft.emergencyPhone))
    errors.emergencyPhone = "กรุณาตรวจสอบเบอร์ผู้ติดต่อฉุกเฉิน";
  if (
    !draft.declineIdentity &&
    draft.identity.trim() &&
    draft.nationality === "ไทย" &&
    !/^\d{13}$/.test(draft.identity.trim())
  )
    errors.identity =
      "เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก หรือเลือกไม่ประสงค์ให้ข้อมูล";
  if (!raceNames.includes(draft.race))
    errors.race = "กรุณาเลือกระยะวิ่งของงานนี้";
  if (!(shirtSizes as readonly string[]).includes(draft.size))
    errors.size = "กรุณาเลือกขนาดเสื้อ";
  if (!provinces.includes(draft.province))
    errors.province = "กรุณาเลือกจังหวัดที่อยู่ปัจจุบัน";
  if (!(applicantTypes as readonly string[]).includes(draft.applicantType))
    errors.applicantType = "กรุณาเลือกสถานะผู้สมัคร";
  return errors;
}

/** Shipping address rules, shared by checkout (validateDelivery) and the admin address edit. */
export function validateAddress(
  draft: Pick<
    DeliveryInput,
    "street" | "subdistrict" | "district" | "province" | "postalCode"
  >,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const [key, label] of [
    ["street", "ที่อยู่"],
    ["subdistrict", "ตำบล / แขวง"],
    ["district", "อำเภอ / เขต"],
  ] as const) {
    if (!draft[key].trim()) errors[key] = `กรุณากรอก${label}`;
  }
  if (!provinces.includes(draft.province))
    errors.province = "กรุณาเลือกจังหวัด";
  if (!/^\d{5}$/.test(draft.postalCode.trim()))
    errors.postalCode = "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก";
  return errors;
}

/** Port of registration.ts validateDelivery. */
export function validateDelivery(draft: DeliveryInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.contact.trim()) errors.contact = "กรุณากรอกชื่อผู้ติดต่อ";
  if (!validPhone(draft.phone))
    errors.phone = "กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง";
  if (draft.email.trim() && !validEmail(draft.email))
    errors.email = "กรุณากรอกอีเมลให้ถูกต้อง";
  if (draft.method === "shipping") Object.assign(errors, validateAddress(draft));
  return errors;
}

/** Validates the whole order payload; keys: `participants.<i>.<field>` and `delivery.<field>`. */
export function validateOrderInput(
  input: CreateOrderInput,
  raceNames: string[],
  today?: string,
): FieldErrors {
  const errors: FieldErrors = {};
  input.participants.forEach((p, i) => {
    for (const [k, v] of Object.entries(
      validateParticipant(p, raceNames, today),
    ))
      errors[`participants.${i}.${k}`] = v;
  });
  for (const [k, v] of Object.entries(validateDelivery(input.delivery)))
    errors[`delivery.${k}`] = v;
  return errors;
}

const phoneLast4 = z
  .string()
  .regex(/^\d{4}$/, "กรุณากรอกเบอร์โทรศัพท์ 4 หลักท้าย");

export const findOrderQuery = z.object({ phoneLast4 });
export type FindOrderQuery = z.infer<typeof findOrderQuery>;

export const slipBody = z.object({ phoneLast4 });
export type SlipBody = z.infer<typeof slipBody>;
