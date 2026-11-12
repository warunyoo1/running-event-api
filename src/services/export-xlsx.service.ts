import ExcelJS from "exceljs";
import { Order } from "../models";
import type { OrderLean } from "../models/order.model";
import type { ExportParticipantsQuery } from "../validators/admin.validator";
import * as participantService from "./participant.service";

/** Thai labels so the sheet reads naturally for staff; unknown values pass through. */
const ORDER_STATUS_LABELS: Record<OrderLean["status"], string> = {
  pending: "รอชำระเงิน",
  slip_uploaded: "รอตรวจสลิป",
  paid: "ชำระเงินแล้ว",
  rejected: "สลิปไม่ผ่าน",
  expired: "หมดอายุ",
  cancelled: "ยกเลิก",
};

const DELIVERY_LABELS: Record<OrderLean["delivery"], string> = {
  pickup: "รับด้วยตนเอง ณ หน้างาน",
  shipping: "จัดส่งทางไปรษณีย์",
};

const thaiDate = (d?: Date | null): string =>
  d
    ? new Date(d).toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";

const addressLine = (o: OrderLean): string =>
  o.address
    ? [
        o.address.street,
        o.address.subdistrict,
        o.address.district,
        o.address.province,
        o.address.postalCode,
      ]
        .filter(Boolean)
        .join(" ")
    : "";

const HEADERS = [
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
];

/** Review outcome derived from order status: blank while no slip has been reviewed yet. */
function reviewResult(order: OrderLean): string {
  if (order.status === "paid") return "ผ่าน";
  if (order.status === "rejected") return "ไม่ผ่าน";
  if (order.status === "slip_uploaded") return "รอตรวจ";
  return "";
}

/** Registrations workbook: one row per participant, order fields repeated per row. */
export async function registrationsXlsx(
  f: ExportParticipantsQuery,
): Promise<Buffer> {
  const participants = await participantService.listForExport(f);
  const orders = await Order.find({
    _id: { $in: participants.map((p) => p.orderId) },
  }).lean();
  const orderById = new Map(orders.map((o) => [String(o._id), o]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "run-event-admin";
  const sheet = workbook.addWorksheet("ผู้สมัคร", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.addRow(HEADERS);
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } };

  for (const p of participants) {
    const order = orderById.get(String(p.orderId));
    sheet.addRow([
      p.orderNo,
      `${p.firstName} ${p.lastName}`.trim(),
      p.phone,
      p.email ?? "",
      p.raceName,
      p.size,
      order ? DELIVERY_LABELS[order.delivery] ?? order.delivery : "",
      order?.contactName ?? "",
      order?.contactPhone ?? "",
      order ? addressLine(order) : "",
      order?.amount ?? 0,
      order ? ORDER_STATUS_LABELS[order.status] ?? order.status : "",
      order ? reviewResult(order) : "",
      order?.reviewedBy ?? "",
      thaiDate(order?.reviewedAt),
      order?.rejectionReason ?? "",
      thaiDate(order?.createdAt),
    ]);
  }
  // Number format for the amount column, then width-fit every column.
  sheet.eachRow((row) => {
    row.getCell(11).numFmt = "#,##0";
  });
  sheet.columns.forEach((column) => {
    let width = 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      width = Math.max(width, Math.min(String(cell.value ?? "").length + 2, 50));
    });
    column.width = width;
  });

  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}
