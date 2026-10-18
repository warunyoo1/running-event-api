import { Types } from "mongoose";
import type { EventImageLean, EventLean } from "../../src/models/event.model";
import type { OrderLean } from "../../src/models/order.model";
import type { ParticipantLean } from "../../src/models/participant.model";
import type { PaymentLean } from "../../src/models/payment.model";
import type { RaceLean } from "../../src/models/race.model";

/** Hand-built lean documents shared by the view unit tests and the golden contract test. */
const oid = (n: number) => new Types.ObjectId(n.toString(16).padStart(24, "0"));
const T0 = new Date("2026-03-01T03:00:00.000Z");
const T1 = new Date("2026-03-02T04:30:00.000Z");

export const EVENT_ID = oid(1);
export const ORDER_ID = oid(2);

export const races = [
  { _id: oid(10), eventId: EVENT_ID, name: "10K", price: 500, quota: 100, reserved: 40, start: "05:30", sortOrder: 0, active: true, createdAt: T0, updatedAt: T1 },
  { _id: oid(11), eventId: EVENT_ID, name: "5K", price: 300, quota: 10, reserved: 12, sortOrder: 1, active: true, createdAt: T0, updatedAt: T1 },
] as unknown as RaceLean[];

export const images = [
  { _id: oid(22), kind: "gallery", filename: "secret-c.jpg", mime: "image/jpeg", size: 30, alt: "", sortOrder: 3, createdAt: T1 },
  { _id: oid(20), kind: "cover", filename: "secret-a.png", mime: "image/png", size: 10, alt: "cover", sortOrder: 1, createdAt: T0 },
  { _id: oid(21), kind: "gallery", filename: "secret-b.webp", mime: "image/webp", size: 20, alt: "b", sortOrder: 2 },
] as unknown as EventImageLean[];

export const event = {
  _id: EVENT_ID, name: "Bangkok Run", slug: "bangkok-run", subtitle: "", description: "", date: "2026-05-01",
  venue: "Lumpini", province: "Bangkok", category: "road", theme: "orange", status: "open", organizer: "", archived: false,
  images, createdAt: T0, updatedAt: T1,
} as unknown as EventLean;

export const eventWithoutImages = { ...event, images: undefined } as unknown as EventLean;

const orderBase = {
  _id: ORDER_ID, orderNo: "RUN-0001", eventId: EVENT_ID, contactName: "A B", contactPhone: "0800000000",
  delivery: "shipping", address: { street: "1 Rd", subdistrict: "S", district: "D", province: "P", postalCode: "10110" },
  subtotal: 800, shippingFee: 50, amount: 850, trackingProvider: "Kerry", trackingNo: "T1",
  raceCounts: [{ raceId: oid(10), count: 2 }], quotaReleased: false, createdAt: T0, updatedAt: T1,
};

export const pendingOrder = { ...orderBase, status: "pending", expiresAt: T1 } as unknown as OrderLean;
export const rejectedOrder = { ...orderBase, status: "rejected", expiresAt: T1, rejectionReason: "blurry", slipUploadedAt: T1, reviewedAt: T1 } as unknown as OrderLean;
export const paidOrder = { ...orderBase, status: "paid", paidAt: T1, transactionRef: "REF1", slipUploadedAt: T0, reviewedAt: T1 } as unknown as OrderLean;

export const participants = [
  { _id: oid(30), orderId: ORDER_ID, eventId: EVENT_ID, raceId: oid(10), raceName: "10K", price: 500, firstName: "Som", lastName: "Chai", gender: "M", birthDate: "1990-01-01", nationality: "TH", idNumberEnc: "ENC", idLast4: "1234", declineIdentity: false, phone: "0811111111", province: "BKK", applicantType: "general", size: "M", bibNo: "A001", collected: true, createdAt: T0, updatedAt: T1 },
  { _id: oid(31), orderId: ORDER_ID, eventId: EVENT_ID, raceId: oid(11), raceName: "5K", price: 300, firstName: "Ann", lastName: "Lee", gender: "F", birthDate: "1995-02-02", nationality: "TH", idNumberEnc: "ENC2", idLast4: "9999", declineIdentity: true, phone: "0822222222", province: "BKK", applicantType: "general", size: "S", collected: false, createdAt: T0, updatedAt: T1 },
] as unknown as ParticipantLean[];

export const payment = {
  _id: oid(40), orderId: ORDER_ID, slipPath: "secret/slip.jpg", slipMime: "image/jpeg", amount: 850, status: "approved",
  transactionRef: "REF1", reviewedAt: T1, createdAt: T0, updatedAt: T1,
} as unknown as PaymentLean;