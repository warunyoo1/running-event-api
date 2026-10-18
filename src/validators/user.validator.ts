import { z } from "zod";
import { roles } from "../config/constants";

const password = z
  .string()
  .min(10, "รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร")
  .max(200);

export const createUserBody = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100),
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(200),
  password,
  role: z.enum(roles),
});
export type CreateUserBody = z.infer<typeof createUserBody>;

export const updateUserBody = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("อีเมลไม่ถูกต้อง")
      .max(200)
      .optional(),
    role: z.enum(roles).optional(),
    active: z.boolean().optional(),
    password: password.optional(),
  })
  .strict();
export type UpdateUserBody = z.infer<typeof updateUserBody>;
