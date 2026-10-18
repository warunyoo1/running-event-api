import { describe, expect, it } from "vitest";
import * as F from "../fixtures/view-fixtures";
import { toAdminImageViews, toPublicImageViews } from "../../src/views/event-image.view";
import type { EventImageLean } from "../../src/models/event.model";

const EVENT_ID = "6ad365e450b60c80aa3103bf";

describe("image views", () => {
  const imgs = [
    { _id: "b", kind: "gallery", filename: "secret-b.jpg", mime: "image/jpeg", size: 10, alt: "", sortOrder: 2 },
    { _id: "a", kind: "cover", filename: "secret-a.png", mime: "image/png", size: 20, alt: "x", sortOrder: 1 },
  ] as unknown as EventImageLean[];

  it("sorts by sortOrder and hides filename/mime/size publicly", () => {
    const v = toPublicImageViews({ images: imgs });
    expect(v.map((i) => i.id)).toEqual(["a", "b"]);
    expect(Object.keys(v[0]).sort()).toEqual(["alt", "id", "kind", "sortOrder", "url"]);
    expect(JSON.stringify(v)).not.toContain("secret");
    expect(v[0].url).toBe("/api/v1/public/event-images/a");
  });

  it("admin view adds previewUrl/mime/size but never filename", () => {
    const v = toAdminImageViews({ _id: EVENT_ID, images: imgs });
    expect(v[0].previewUrl).toBe(`/api/v1/admin/events/${EVENT_ID}/images/a/file`);
    expect(v[0].mime).toBe("image/png");
    expect(JSON.stringify(v)).not.toContain("secret");
  });

  it("treats old documents without images as empty", () => {
    expect(toPublicImageViews({})).toEqual([]);
    expect(toAdminImageViews({ _id: EVENT_ID, images: undefined })).toEqual([]);
  });

  it("sorting is stable and does not mutate the input", () => {
    const same = F.images.map((i) => ({ ...i, sortOrder: 1 })) as EventImageLean[];
    const before = same.map((i) => String(i._id));
    expect(toPublicImageViews({ images: same }).map((i) => i.id)).toEqual(before);
    expect(same.map((i) => String(i._id))).toEqual(before);
  });

  it("admin createdAt is an ISO string, or null when missing", () => {
    const v = toAdminImageViews(F.event);
    expect(v.map((i) => i.createdAt)).toEqual(["2026-03-01T03:00:00.000Z", null, "2026-03-02T04:30:00.000Z"]);
  });
});