import { randomUUID } from "node:crypto";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";

export type DetectedImage = {
  mime: "image/jpeg" | "image/png" | "image/webp";
  ext: "jpg" | "png" | "webp";
};

/** Detect the real image type from magic bytes (never trust client mime/extension). */
export function detectImage(buf: Buffer): DetectedImage | null {
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

const EVENT_ID = /^[0-9a-f]{24}$/;
const EVENT_IMAGE_FILE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

const eventImagesBase = () => path.resolve(env.UPLOAD_DIR, "events");

/** Resolves `UPLOAD_DIR/events/<eventId>/<filename>`; throws on anything but a server generated name. */
export function resolveEventImagePath(eventId: string, filename: string): string {
  if (!EVENT_ID.test(eventId) || !EVENT_IMAGE_FILE.test(filename))
    throw new Error("Invalid event image path");
  const dir = path.join(eventImagesBase(), eventId);
  const full = path.resolve(dir, filename);
  if (path.dirname(full) !== dir) throw new Error("Invalid event image path");
  return full;
}

/** Writes an event image with a server generated name (never the client filename); returns that name. */
export async function saveEventImage(
  eventId: string,
  buf: Buffer,
  ext: DetectedImage["ext"],
): Promise<string> {
  const filename = `${randomUUID()}.${ext}`;
  const full = resolveEventImagePath(eventId, filename);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf, { flag: "wx", mode: 0o640 });
  return filename;
}

/** Removes `UPLOAD_DIR/events/<eventId>` with all its files. Never throws: failures are logged, the DB is the truth. */
export async function deleteEventImageDir(eventId: string): Promise<void> {
  try {
    if (!EVENT_ID.test(eventId)) throw new Error("Invalid event id");
    const base = eventImagesBase();
    const dir = path.resolve(base, eventId);
    if (path.dirname(dir) !== base) throw new Error("Invalid event image dir");
    await rm(dir, { recursive: true, force: true });
  } catch (err) {
    console.warn("event image dir delete failed", err);
  }
}

/** Removes an event image file. A missing file is fine; other failures are logged, never thrown. */
export async function deleteEventImage(eventId: string, filename: string): Promise<void> {
  try {
    await unlink(resolveEventImagePath(eventId, filename));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT")
      console.warn("event image delete failed", err);
  }
}
