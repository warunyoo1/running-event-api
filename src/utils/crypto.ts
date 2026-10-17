import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env";

/** AES-256-GCM. Output format: iv:tag:ciphertext (base64 each). */
export function encryptText(plain: string, key: Buffer = env.idKey): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc]
    .map((b) => b.toString("base64"))
    .join(":");
}

export function decryptText(payload: string, key: Buffer = env.idKey): string {
  const [iv, tag, enc] = payload
    .split(":")
    .map((p) => Buffer.from(p, "base64"));
  if (!iv || !tag || !enc) throw new Error("Invalid encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8",
  );
}

/** Show only the last 4 characters, e.g. `*********1234`. */
export function maskLast4(last4?: string | null): string {
  return last4 ? `*********${last4}` : "";
}
