import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";

export type ImageKind = {
  mime: "image/jpeg" | "image/png" | "image/webp";
  ext: "jpg" | "png" | "webp";
};

/** Detect the real image type from magic bytes (never trust client mime/extension). */
export function detectImage(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return { mime: "image/jpeg", ext: "jpg" };
  if (
    buf.length >= 8 &&
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return { mime: "image/png", ext: "png" };
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return { mime: "image/webp", ext: "webp" };
  return null;
}

const slipDir = () => path.resolve(env.UPLOAD_DIR, "slips");

/** Writes a slip with a server generated name; returns the stored relative name. */
export async function saveSlip(buf: Buffer, ext: string): Promise<string> {
  await mkdir(slipDir(), { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(slipDir(), name), buf, { flag: "wx", mode: 0o640 });
  return name;
}

export async function deleteSlip(name: string): Promise<void> {
  try {
    await unlink(resolveSlipPath(name));
  } catch {
    /* already gone */
  }
}

/** Resolves a stored name inside the slips dir; throws on traversal. */
export function resolveSlipPath(name: string): string {
  const base = slipDir();
  const full = path.resolve(base, name);
  if (path.dirname(full) !== base) throw new Error("Invalid slip path");
  return full;
}
