import { Order } from "../models";
import type { AdminOrdersQuery } from "../validators/admin.validator";
import * as orderService from "./order.service";
import * as participantService from "./participant.service";
import * as shippingService from "./shipping.service";
import { toCsv } from "../utils/csv";
import { bangkokRange } from "../utils/date-range";
import { escapeRegex } from "../utils/pagination";

const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : "");

export async function ordersCsv(
  q: Omit<AdminOrdersQuery, "page" | "pageSize">,
) {
  const filter: Record<string, unknown> = {};
  if (q.eventId) filter.eventId = q.eventId;
  if (q.status) filter.status = q.status;
  const range = bangkokRange(q.from, q.to);
  if (range) filter.createdAt = range;
  if (q.q) {
    const re = new RegExp(escapeRegex(q.q), "i");
    filter.$or = [{ orderNo: re }, { contactName: re }, { contactPhone: re }];
  }
  const orders = await orderService.decorateOrders(
    await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(participantService.EXPORT_LIMIT)
      .lean(),
  );
  return toCsv([
    [
      "orderNo",
      "event",
      "contactName",
      "contactPhone",
      "delivery",
      "participants",
      "subtotal",
      "shippingFee",
      "amount",
      "status",
      "transactionRef",
      "trackingNo",
      "createdAt",
      "paidAt",
    ],
    ...orders.map((o: any) => [
      o.orderNo,
      o.eventName,
      o.contactName,
      o.contactPhone,
      o.delivery,
      o.participantCount,
      o.subtotal,
      o.shippingFee,
      o.amount,
      o.status,
      o.transactionRef ?? "",
      o.trackingNo ?? "",
      iso(o.createdAt),
      iso(o.paidAt),
    ]),
  ]);
}

export async function participantsCsv(f: {
  eventId?: string;
  q?: string;
  race?: string;
  status?: string;
}) {
  const rows = await participantService.listForExport(f);
  return toCsv([
    [
      "orderNo",
      "orderStatus",
      "firstName",
      "lastName",
      "gender",
      "birthDate",
      "nationality",
      "idNumber(masked)",
      "phone",
      "email",
      "race",
      "size",
      "bibNo",
      "collected",
      "province",
      "team",
      "applicantType",
      "medical",
      "blood",
      "emergencyName",
      "emergencyPhone",
    ],
    ...rows.map((p: any) => [
      p.orderNo,
      p.orderStatus,
      p.firstName,
      p.lastName,
      p.gender,
      p.birthDate,
      p.nationality,
      p.idNumber,
      p.phone,
      p.email ?? "",
      p.raceName,
      p.size,
      p.bibNo ?? "",
      p.collected ? "yes" : "no",
      p.province,
      p.team ?? "",
      p.applicantType,
      p.medical ?? "",
      p.blood ?? "",
      p.emergencyName ?? "",
      p.emergencyPhone ?? "",
    ]),
  ]);
}

export async function fulfillmentCsv(f: {
  eventId?: string;
  method?: "pickup" | "shipping";
}) {
  const orders = await shippingService.listForExport(f);
  const a = (o: any) =>
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
  return toCsv([
    [
      "orderNo",
      "contactName",
      "contactPhone",
      "delivery",
      "address",
      "trackingProvider",
      "trackingNo",
      "participant",
      "race",
      "size",
      "bibNo",
      "collected",
    ],
    ...orders.flatMap((o) =>
      o.participants.map((p) => [
        o.orderNo,
        o.contactName,
        o.contactPhone,
        o.delivery,
        a(o),
        o.trackingProvider ?? "",
        o.trackingNo ?? "",
        p.name,
        p.race,
        p.size,
        p.bibNo ?? "",
        p.collected ? "yes" : "no",
      ]),
    ),
  ]);
}
