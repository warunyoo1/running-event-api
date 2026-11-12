import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParticipantWithOrderView } from "../src/views/participant.view";

vi.mock("../src/services/participant.service", () => ({
  listForExport: vi.fn(),
}));
vi.mock("../src/models", () => ({
  Order: { find: vi.fn() },
}));

import { Order } from "../src/models";
import * as participantService from "../src/services/participant.service";
import { registrationsXlsx } from "../src/services/export-xlsx.service";

const participant = (over: Partial<ParticipantWithOrderView> = {}) =>
  ({
    id: "p1",
    orderId: "o1",
    orderNo: "RUN-001",
    orderStatus: "paid",
    firstName: "สมชาย",
    lastName: "ใจดี",
    phone: "0812345678",
    email: "somchai@example.com",
    raceName: "10K",
    size: "L",
    ...over,
  }) as ParticipantWithOrderView;

const order = (over: Record<string, unknown> = {}) => ({
  _id: "o1",
  orderNo: "RUN-001",
  status: "paid",
  delivery: "shipping",
  contactName: "สมหญิง",
  contactPhone: "0898765432",
  address: {
    street: "1 ถ.รัชดา",
    subdistrict: "ดินแดง",
    district: "ดินแดง",
    province: "กรุงเทพฯ",
    postalCode: "10400",
  },
  amount: 750,
  reviewedBy: "admin1",
  reviewedAt: new Date("2026-01-02T03:04:05Z"),
  rejectionReason: "",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

const findMock = Order.find as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.mocked(participantService.listForExport).mockResolvedValue([participant()]);
  findMock.mockReturnValue({
    lean: async () => [order()],
  });
});

async function sheetRows() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await registrationsXlsx({}));
  const sheet = workbook.getWorksheet("ผู้สมัคร")!;
  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) =>
      values.push(cell.value == null ? "" : String(cell.value)),
    );
    rows.push(values);
  });
  return rows;
}

describe("registrationsXlsx", () => {
  it("has the expected Thai headers", async () => {
    const rows = await sheetRows();
    expect(rows[0]).toEqual([
      "เลขออเดอร์",
      "ชื่อ-นามสกุล",
      "เบอร์โทรศัพท์",
      "อีเมล",
      "ประเภทการแข่งขัน / ระยะทาง",
      "ขนาดเสื้อ",
      "รูปแบบการรับเสื้อ",
      "ชื่อผู้ติดต่อ",
      "เบอร์ผู้ติดต่อ",
      "ที่อยู่จัดส่ง",
      "ยอดเงิน (บาท)",
      "สถานะการชำระเงิน",
      "ผลการตรวจสลิป",
      "ผู้ตรวจสลิป",
      "วันที่ตรวจสลิป",
      "เหตุผลที่ปฏิเสธ",
      "วันที่สมัคร",
    ]);
  });

  it("writes one row per participant with order fields", async () => {
    const rows = await sheetRows();
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(
      expect.arrayContaining([
        "RUN-001",
        "สมชาย ใจดี",
        "0812345678",
        "10K",
        "L",
        "จัดส่งทางไปรษณีย์",
        "สมหญิง",
        "0898765432",
        "1 ถ.รัชดา ดินแดง ดินแดง กรุงเทพฯ 10400",
        "ชำระเงินแล้ว",
        "ผ่าน",
        "admin1",
      ]),
    );
  });

  it("shows rejection outcome and reason for rejected orders", async () => {
    findMock.mockReturnValue({
      lean: async () => [order({ status: "rejected", rejectionReason: "ยอดไม่ตรง" })],
    });
    const rows = await sheetRows();
    expect(rows[1]).toEqual(
      expect.arrayContaining(["สลิปไม่ผ่าน", "ไม่ผ่าน", "ยอดไม่ตรง"]),
    );
  });
});
