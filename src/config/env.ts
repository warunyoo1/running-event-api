import "dotenv/config";
import { z } from "zod";

const bool = z
  .enum(["true", "false", ""])
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v === "true"));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  COOKIE_SECURE: bool,
  CORS_ORIGINS: z.string().default(""),
  ID_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "ID_ENCRYPTION_KEY must be base64 of 32 bytes"),
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_SLIP_MB: z.coerce.number().positive().default(5),
  ORDER_EXPIRE_HOURS: z.coerce.number().positive().default(24),
  SHIPPING_FEE: z.coerce.number().int().min(0).default(50),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  LOGIN_RATE_MAX: z.coerce.number().int().positive().default(10),
  PUBLIC_RATE_MAX: z.coerce.number().int().positive().default(120),
  ORDER_RATE_MAX: z.coerce.number().int().positive().default(20),
  UPLOAD_RATE_MAX: z.coerce.number().int().positive().default(20),
  IMAGE_RATE_MAX: z.coerce.number().int().positive().default(600),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ");
  throw new Error(`Invalid environment configuration:\n  ${issues}`);
}

const raw = parsed.data;
export const env = {
  ...raw,
  isProd: raw.NODE_ENV === "production",
  isTest: raw.NODE_ENV === "test",
  cookieSecure: raw.COOKIE_SECURE ?? raw.NODE_ENV === "production",
  corsOrigins: raw.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
  idKey: Buffer.from(raw.ID_ENCRYPTION_KEY, "base64"),
  maxSlipBytes: Math.floor(raw.MAX_SLIP_MB * 1024 * 1024),
};

