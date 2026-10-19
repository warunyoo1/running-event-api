import { z } from "zod";
import {
  EVENT_IMAGE_ALT_MAX,
  EVENT_IMAGE_MAX_PER_EVENT,
  EVENT_IMAGE_SORT_MAX,
  PUBLIC_EVENT_STATUSES,
  TIME_HHMM,
  eventCategories,
  eventImageKinds,
  eventStatuses,
  eventThemes,
} from "../config/constants";
import { objectId, optStr, pageQuery } from "./common.validator";

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, "วันที่ไม่ถูกต้อง");

const raceBody = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "กรุณากรอกชื่อระยะ").max(50),
  price: z.number().int("ราคาต้องเป็นจำนวนเต็ม").min(0),
  quota: z
    .number()
    .int("โควตาต้องเป็นจำนวนเต็ม")
    .min(1, "โควตาต้องอย่างน้อย 1"),
  // `null` clears the start time.
  start: z.string().regex(TIME_HHMM, "เวลาต้องเป็น HH:mm").nullish(),
  prizes: z.array(z.object({ rank: z.number().int().min(1).max(100), amount: z.number().int("เงินรางวัลต้องเป็นจำนวนเต็มบาท").min(0).max(Number.MAX_SAFE_INTEGER), trophy: z.boolean().optional() })).max(100).optional().superRefine((prizes, ctx) => {
    const ranks = new Set<number>();
    prizes?.forEach((prize, index) => {
      if (ranks.has(prize.rank)) ctx.addIssue({ code: "custom", path: [index, "rank"], message: "อันดับรางวัลซ้ำกันในระยะนี้" });
      ranks.add(prize.rank);
    });
  }),
});

const optionalWebLink = z.union([
  z.literal(""),
  z.string().trim().max(2048).url("กรอกลิงก์ให้ถูกต้อง เช่น https://example.com").refine((value) => /^https?:\/\//i.test(value), "ใช้ได้เฉพาะลิงก์ http หรือ https"),
]).optional();

export const eventBody = z
  .object({
    name: z.string().trim().min(1, "กรุณากรอกชื่องาน").max(200),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug ใช้ได้เฉพาะ a-z 0-9 และ -")
      .max(120),
    subtitle: z.string().max(300).optional(),
    description: z.string().max(5000).optional(),
    websiteUrl: optionalWebLink,
    locationUrl: optionalWebLink,
    contactPhones: z.array(z.string().trim().transform((phone) => phone.replace(/[ ()-]/g, "")).pipe(z.string().regex(/^\+?[0-9]{7,15}$/, "กรอกเบอร์โทร 7–15 หลัก หรือใช้รหัสประเทศนำหน้าด้วย +"))).max(10, "เพิ่มเบอร์โทรได้ไม่เกิน 10 เบอร์").refine((phones) => new Set(phones).size === phones.length, "เบอร์โทรซ้ำกัน").optional(),
    date: ymd,
    venue: z.string().trim().min(1, "กรุณากรอกสถานที่").max(300),
    startPoint: z.string().trim().max(300, "จุดปล่อยตัวยาวได้ไม่เกิน 300 ตัวอักษร").optional(),
    province: z.string().max(100).optional(),
    // `null` on these three clears them (category/theme reset to the defaults, registrationEnds is unset).
    category: z.enum(eventCategories).nullish(),
    theme: z.enum(eventThemes).nullish(),
    status: z.enum(eventStatuses),
    registrationStarts: ymd.nullish(),
    registrationEnds: ymd.nullish(),
    organizer: z.string().max(200).optional(),
    refundPolicy: z.string().max(2000).optional(),
    races: z.array(raceBody).min(1, "ต้องมีอย่างน้อย 1 ระยะ").max(10),
  })
  .superRefine((v, ctx) => {
    if (v.registrationStarts && v.registrationStarts > v.date) ctx.addIssue({ code: "custom", path: ["registrationStarts"], message: "วันเปิดรับสมัครต้องไม่เกินวันที่จัดงาน" });
    if (v.registrationStarts && v.registrationEnds && v.registrationStarts > v.registrationEnds) ctx.addIssue({ code: "custom", path: ["registrationEnds"], message: "วันปิดรับสมัครต้องไม่ก่อนวันเปิดรับสมัคร" });
    const seen = new Set<string>();
    v.races.forEach((r, i) => {
      if (seen.has(r.name))
        ctx.addIssue({
          code: "custom",
          path: ["races", i, "name"],
          message: "ชื่อระยะซ้ำกัน",
        });
      seen.add(r.name);
    });
  });
export type EventBody = z.infer<typeof eventBody>;

export const publicEventsQuery = z.object({
  q: optStr,
  province: optStr,
  month: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
  ),
  distance: optStr,
  category: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(eventCategories).optional(),
  ),
  status: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(PUBLIC_EVENT_STATUSES).optional(),
  ),
});
export type PublicEventsQuery = z.infer<typeof publicEventsQuery>;

export const adminEventsQuery = pageQuery.extend({
  q: optStr,
  status: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(eventStatuses).optional(),
  ),
  /** `true` lists archived events, `false` (default) the active ones. */
  archived: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  ),
});
export type AdminEventsQuery = z.infer<typeof adminEventsQuery>;

// --- event images (kept out of `eventBody`: PUT /events/:id never touches images) ---
const imageAlt = z
  .string()
  .trim()
  .max(EVENT_IMAGE_ALT_MAX, `alt ยาวได้ไม่เกิน ${EVENT_IMAGE_ALT_MAX} ตัวอักษร`);

export const uploadImagesBody = z.object({
  kind: z.enum(eventImageKinds, { message: "ประเภทรูปไม่ถูกต้อง" }),
  alt: imageAlt.optional(),
});
export type UploadImagesBody = z.infer<typeof uploadImagesBody>;

export const patchImageBody = z
  .object({
    kind: z.enum(eventImageKinds, { message: "ประเภทรูปไม่ถูกต้อง" }).optional(),
    alt: imageAlt.optional(),
    sortOrder: z.number().int().min(0).max(EVENT_IMAGE_SORT_MAX).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "ไม่มีข้อมูลที่จะแก้ไข",
  });
export type PatchImageBody = z.infer<typeof patchImageBody>;

export const reorderBody = z
  .object({ ids: z.array(objectId).min(1).max(EVENT_IMAGE_MAX_PER_EVENT) })
  .refine((v) => new Set(v.ids).size === v.ids.length, {
    path: ["ids"],
    message: "รายการรูปภาพซ้ำกัน",
  });
export type ReorderBody = z.infer<typeof reorderBody>;
