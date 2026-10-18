import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { afterAll, describe, expect, it, vi } from "vitest";
import { eventImageKinds } from "../src/config/constants";
import { resolveError } from "../src/middlewares/error-handler";
import {
  deleteEventImageDir,
  detectImage,
  resolveEventImagePath,
} from "../src/utils/slip-file";
import {
  eventBody,
  patchImageBody,
  reorderBody,
  uploadImagesBody,
} from "../src/validators/event.validator";

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);
const EVENT_ID = "6ad365e450b60c80aa3103bf";
const FILE = "0b7cbd3e-6a52-4a6c-9d36-0d3b3c9f1a11.jpg";

describe("detectImage", () => {
  it("accepts jpg, png and webp by magic bytes", () => {
    expect(detectImage(JPG)?.ext).toBe("jpg");
    expect(detectImage(PNG)?.ext).toBe("png");
    expect(detectImage(WEBP)?.ext).toBe("webp");
  });
  it("rejects svg, gif, exe, text and short buffers", () => {
    expect(detectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectImage(Buffer.from("GIF89a....."))).toBeNull();
    expect(detectImage(Buffer.from("MZ\x90\x00"))).toBeNull();
    expect(detectImage(Buffer.from("hello world, not an image"))).toBeNull();
    expect(detectImage(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe("resolveEventImagePath", () => {
  it("resolves a server generated name inside events/<id>", () => {
    const p = resolveEventImagePath(EVENT_ID, FILE);
    expect(path.basename(p)).toBe(FILE);
    expect(path.basename(path.dirname(p))).toBe(EVENT_ID);
  });
  it("rejects traversal, absolute paths, bad extension and bad ids", () => {
    expect(() => resolveEventImagePath(EVENT_ID, "../x.jpg")).toThrow();
    expect(() => resolveEventImagePath(EVENT_ID, `../${FILE}`)).toThrow();
    expect(() => resolveEventImagePath(EVENT_ID, "/etc/passwd")).toThrow();
    expect(() => resolveEventImagePath(EVENT_ID, FILE.replace("jpg", "svg"))).toThrow();
    expect(() => resolveEventImagePath("../slips", FILE)).toThrow();
    expect(() => resolveEventImagePath("abc", FILE)).toThrow();
  });
});

describe("deleteEventImageDir", () => {
  const dir = path.dirname(resolveEventImagePath(EVENT_ID, FILE));
  // A sibling that an invalid id must never touch.
  const sibling = path.join(path.dirname(dir), "keep-me");

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
    await rm(sibling, { recursive: true, force: true });
    // vitest.config.mts points UPLOAD_DIR at ./uploads-unit-test (not gitignored): remove what we created.
    const root = path.dirname(path.dirname(dir));
    if (path.basename(root) === "uploads-unit-test")
      await rm(root, { recursive: true, force: true });
  });

  it("removes the event directory with its files", async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, FILE), JPG);
    await deleteEventImageDir(EVENT_ID);
    expect(existsSync(dir)).toBe(false);
  });

  it("does nothing for a missing directory", async () => {
    await expect(deleteEventImageDir(EVENT_ID)).resolves.toBeUndefined();
  });

  it("never throws and deletes nothing for invalid ids", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await mkdir(sibling, { recursive: true });
    await writeFile(path.join(sibling, "a.jpg"), JPG);
    for (const bad of ["abc", "../slips", "..", "", "keep-me"])
      await expect(deleteEventImageDir(bad)).resolves.toBeUndefined();
    expect(existsSync(path.join(sibling, "a.jpg"))).toBe(true);
    warn.mockRestore();
  });
});

describe("multer error mapping", () => {
  it("maps count, size and other errors", () => {
    const e = (code: ConstructorParameters<typeof multer.MulterError>[0]) =>
      resolveError(new multer.MulterError(code));
    expect(e("LIMIT_FILE_COUNT")).toMatchObject({ status: 422, code: "TOO_MANY_FILES" });
    expect(e("LIMIT_FILE_SIZE")).toMatchObject({ status: 413, code: "FILE_TOO_LARGE" });
    expect(e("LIMIT_UNEXPECTED_FILE")).toMatchObject({ status: 400, code: "UPLOAD_ERROR" });
  });
});

describe("image validators", () => {
  it("uploadImagesBody", () => {
    expect(uploadImagesBody.safeParse({ kind: "gallery" }).success).toBe(true);
    expect(uploadImagesBody.safeParse({ kind: "gallery", alt: " x " }).data?.alt).toBe("x");
    expect(uploadImagesBody.safeParse({ kind: "svg" }).success).toBe(false);
    expect(uploadImagesBody.safeParse({}).success).toBe(false);
    expect(uploadImagesBody.safeParse({ kind: "cover", alt: "a".repeat(201) }).success).toBe(false);
    for (const k of eventImageKinds)
      expect(uploadImagesBody.safeParse({ kind: k }).success).toBe(true);
  });
  it("patchImageBody", () => {
    expect(patchImageBody.safeParse({ sortOrder: 0 }).success).toBe(true);
    expect(patchImageBody.safeParse({}).success).toBe(false);
    expect(patchImageBody.safeParse({ sortOrder: -1 }).success).toBe(false);
    expect(patchImageBody.safeParse({ sortOrder: 1.5 }).success).toBe(false);
    expect(patchImageBody.safeParse({ kind: "nope" }).success).toBe(false);
  });
  it("reorderBody", () => {
    expect(reorderBody.safeParse({ ids: [EVENT_ID] }).success).toBe(true);
    expect(reorderBody.safeParse({ ids: [] }).success).toBe(false);
    expect(reorderBody.safeParse({ ids: [EVENT_ID, EVENT_ID] }).success).toBe(false);
    expect(reorderBody.safeParse({ ids: ["x"] }).success).toBe(false);
    expect(reorderBody.safeParse({ ids: Array(31).fill(EVENT_ID) }).success).toBe(false);
  });
  it("eventBody output has no images key (PUT never touches images)", () => {
    const parsed = eventBody.parse({
      name: "n", slug: "n", date: "2026-01-01", venue: "v", status: "draft",
      races: [{ name: "5K", price: 0, quota: 1 }],
      images: [{ kind: "cover" }],
    });
    expect(parsed).not.toHaveProperty("images");
  });
});
