import { describe, expect, it } from "vitest";
import { ORDER_NOTE_MAX } from "../src/config/constants";
import { addressBody, noteBody, noteParams } from "../src/validators/admin.validator";
import {
  validateAddress,
  validateDelivery,
  type DeliveryInput,
} from "../src/validators/order.validator";
import { flattenZod } from "../src/validators/common.validator";

const address = {
  street: "99/1 ถนนสุขุมวิท",
  subdistrict: "คลองเตย",
  district: "คลองเตย",
  province: "กรุงเทพมหานคร",
  postalCode: "10110",
};
const delivery = (over: Partial<DeliveryInput> = {}): DeliveryInput => ({
  method: "shipping",
  contact: "สมชาย",
  phone: "0812345678",
  email: "",
  ...address,
  ...over,
});

describe("validateAddress", () => {
  it("accepts a complete address", () => {
    expect(validateAddress(address)).toEqual({});
  });

  it("reports each invalid field under its own key", () => {
    expect(
      validateAddress({ street: " ", subdistrict: "", district: "  ", province: "Nowhere", postalCode: "1011" }),
    ).toEqual({
      street: "กรุณากรอกที่อยู่",
      subdistrict: "กรุณากรอกตำบล / แขวง",
      district: "กรุณากรอกอำเภอ / เขต",
      province: "กรุณาเลือกจังหวัด",
      postalCode: "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก",
    });
  });

  it("trims the postal code before checking it", () => {
    expect(validateAddress({ ...address, postalCode: " 10110 " })).toEqual({});
    expect(validateAddress({ ...address, postalCode: "1011a" })).toHaveProperty("postalCode");
  });
});

describe("validateDelivery (checkout regression)", () => {
  it("pickup needs no address", () => {
    expect(
      validateDelivery(delivery({ method: "pickup", street: "", subdistrict: "", district: "", province: "", postalCode: "" })),
    ).toEqual({});
  });

  it("pickup still validates contact fields", () => {
    expect(validateDelivery(delivery({ method: "pickup", contact: " ", phone: "123", email: "x" }))).toEqual({
      contact: "กรุณากรอกชื่อผู้ติดต่อ",
      phone: "กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง",
      email: "กรุณากรอกอีเมลให้ถูกต้อง",
    });
  });

  it("shipping accepts a complete address", () => {
    expect(validateDelivery(delivery())).toEqual({});
  });

  it("shipping reports address errors with the same keys and messages as before", () => {
    expect(
      validateDelivery(delivery({ street: "", subdistrict: "", district: "", province: "", postalCode: "abc" })),
    ).toEqual({
      street: "กรุณากรอกที่อยู่",
      subdistrict: "กรุณากรอกตำบล / แขวง",
      district: "กรุณากรอกอำเภอ / เขต",
      province: "กรุณาเลือกจังหวัด",
      postalCode: "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก",
    });
  });

  it("keeps contact errors before address errors", () => {
    const keys = Object.keys(validateDelivery(delivery({ contact: "", street: "" })));
    expect(keys).toEqual(["contact", "street"]);
  });
});

describe("noteBody", () => {
  const text = (n: number) => "ก".repeat(n);

  it("trims and accepts 1..1000 characters", () => {
    expect(noteBody.parse({ text: "  hello  " })).toEqual({ text: "hello" });
    expect(noteBody.safeParse({ text: text(1) }).success).toBe(true);
    expect(noteBody.safeParse({ text: text(ORDER_NOTE_MAX) }).success).toBe(true);
  });

  it("rejects empty, whitespace-only, missing and too long text", () => {
    for (const body of [{ text: "" }, { text: "   \n " }, {}, { text: text(ORDER_NOTE_MAX + 1) }]) {
      const result = noteBody.safeParse(body);
      expect(result.success).toBe(false);
      if (!result.success) expect(flattenZod(result.error)).toHaveProperty("text");
    }
  });
});

describe("addressBody", () => {
  it("accepts a valid address", () => {
    expect(addressBody.safeParse(address).success).toBe(true);
  });

  it("reports field errors keyed by field name", () => {
    const result = addressBody.safeParse({ ...address, street: " ", province: "x", postalCode: "12" });
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(flattenZod(result.error)).sort()).toEqual(["postalCode", "province", "street"]);
  });

  it("rejects missing fields and over-long values", () => {
    expect(addressBody.safeParse({}).success).toBe(false);
    const tooLong = addressBody.safeParse({ ...address, street: "x".repeat(301) });
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) expect(flattenZod(tooLong.error)).toHaveProperty("street");
  });
});

describe("noteParams", () => {
  const id = "507f1f77bcf86cd799439011";

  it("needs two valid object ids", () => {
    expect(noteParams.safeParse({ id, noteId: id }).success).toBe(true);
    expect(noteParams.safeParse({ id, noteId: "nope" }).success).toBe(false);
    expect(noteParams.safeParse({ id: "nope", noteId: id }).success).toBe(false);
    expect(noteParams.safeParse({ id }).success).toBe(false);
  });
});
