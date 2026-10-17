import { z } from "zod";
import {
  PUBLIC_EVENT_STATUSES,
  TIME_HHMM,
  eventCategories,
  eventStatuses,
  eventThemes,
} from "../config/constants";
import { optStr, pageQuery } from "./common.validator";

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
  start: z.string().regex(TIME_HHMM, "เวลาต้องเป็น HH:mm").optional(),
});

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
    date: ymd,
    venue: z.string().trim().min(1, "กรุณากรอกสถานที่").max(300),
    province: z.string().max(100).optional(),
    category: z.enum(eventCategories).optional(),
    theme: z.enum(eventThemes).optional(),
    status: z.enum(eventStatuses),
    registrationEnds: ymd.optional(),
    organizer: z.string().max(200).optional(),
    refundPolicy: z.string().max(2000).optional(),
    races: z.array(raceBody).min(1, "ต้องมีอย่างน้อย 1 ระยะ").max(10),
  })
  .superRefine((v, ctx) => {
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
});
export type AdminEventsQuery = z.infer<typeof adminEventsQuery>;
