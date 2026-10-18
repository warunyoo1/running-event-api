import { EXPORT_LIMIT } from "../config/constants";
import { Order } from "../models";
import { toCsv } from "../utils/csv";
import type {
  ExportOrdersQuery,
  ExportParticipantsQuery,
  ExportShippingQuery,
} from "../validators/admin.validator";
import type { ShippingRowView } from "../views/shipping.view";
import { adminFilter, decorateOrders } from "./order/order-admin.service";
import * as participantService from "./participant.service";
import * as shippingService from "./shipping.service";

const iso = (d?: Date | null): string => (d ? new Date(d).toISOString() : "");

const addressLine = (o: ShippingRowView): string =>
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

export async function ordersCsv(q: ExportOrdersQuery): Promise<string> {
  const orders = await decorateOrders(
    await Order.find(adminFilter(q))
      .sort({ createdAt: -1 })
      .limit(EXPORT_LIMIT)
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
    ...orders.map((o) => [
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

export async function participantsCsv(
  f: ExportParticipantsQuery,
): Promise<string> {
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
    ...rows.map((p) => [
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

export async function fulfillmentCsv(
  f: ExportShippingQuery,
): Promise<string> {
  const orders = await shippingService.listForExport(f);
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
        addressLine(o),
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
