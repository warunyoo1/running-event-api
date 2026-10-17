import { z } from "zod";

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(200),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน").max(200),
});

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน").max(200),
  newPassword: z
    .string()
    .min(10, "รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร")
    .max(200),
});
