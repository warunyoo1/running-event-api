import type { Types } from "mongoose";
import { MS_PER_HOUR, PUBLIC_EVENT_STATUSES } from "../../config/constants";
import { env } from "../../config/env";
import { EventModel, Order, Participant, Race } from "../../models";
import type { RaceLean } from "../../models/race.model";
import { ApiError } from "../../utils/api-error";
import { encryptText } from "../../utils/crypto";
import { bangkokToday } from "../../utils/date-range";
import { generateOrderNo } from "../../utils/order-no";
import { withTransaction } from "../../utils/transaction";
import {
  cleanPhone,
  validateOrderInput,
  type CreateOrderInput,
  type DeliveryInput,
  type ParticipantInput,
} from "../../validators/order.validator";
import { reserveQuota, type RaceCounts } from "./order-quota";

/** Extra attempts when a generated order number collides with an existing one. */
const ORDER_NO_RETRIES = 5;

const optionalText = (value: string) => value.trim() || undefined;

function addressOf(d: DeliveryInput) {
  if (d.method !== "shipping") return undefined;
  return {
    street: d.street.trim(),
    subdistrict: d.subdistrict.trim(),
    district: d.district.trim(),
    province: d.province,
    postalCode: d.postalCode.trim(),
  };
}

function participantRecord(
  p: ParticipantInput,
  race: RaceLean,
  orderId: Types.ObjectId,
  eventId: Types.ObjectId,
) {
  const identity = p.identity.trim();
  const storeIdentity = !p.declineIdentity && identity !== "";
  return {
    orderId,
    eventId,
    raceId: race._id,
    raceName: race.name,
    price: race.price,
    firstName: p.firstName.trim(),
    lastName: p.lastName.trim(),
    gender: p.gender,
    birthDate: `${p.birthYear}-${p.birthMonth.padStart(2, "0")}-${p.birthDay.padStart(2, "0")}`,
    nationality: p.nationality,
    idNumberEnc: storeIdentity ? encryptText(identity) : undefined,
    idLast4: storeIdentity ? identity.slice(-4) : undefined,
    declineIdentity: p.declineIdentity,
    email: optionalText(p.email),
    phone: cleanPhone(p.phone),
    medical: optionalText(p.medical),
    blood: optionalText(p.blood),
    emergencyName: optionalText(p.emergencyName),
    emergencyRelation: optionalText(p.emergencyRelation),
    emergencyPhone: p.emergencyPhone.trim()
      ? cleanPhone(p.emergencyPhone)
      : undefined,
    province: p.province,
    team: optionalText(p.team),
    applicantType: p.applicantType,
    size: p.size,
  };
}

const isOrderNoCollision = (err: unknown) =>
  (err as { code?: number }).code === 11000 &&
  String((err as Error).message).includes("orderNo_unique");

async function loadOpenEvent(slug: string) {
  const event = await EventModel.findOne({
    slug: slug.toLowerCase(),
    archived: false,
    status: { $in: [...PUBLIC_EVENT_STATUSES] },
  });
  if (!event) throw ApiError.notFound("ไม่พบงานวิ่ง", "EVENT_NOT_FOUND");
  if (
    event.status !== "open" ||
    (event.registrationEnds && event.registrationEnds < bangkokToday())
  ) {
    throw ApiError.conflict("REGISTRATION_CLOSED", "งานนี้ปิดรับสมัครแล้ว");
  }
  return event;
}

/** Create an order: validate, atomically reserve quota in a transaction, compute totals server-side. */
export async function createOrder(slug: string, input: CreateOrderInput) {
  const event = await loadOpenEvent(slug);
  const races: RaceLean[] = await Race.find({
    eventId: event._id,
    active: true,
  }).lean();
  const errors = validateOrderInput(
    input,
    races.map((r) => r.name),
  );
  if (Object.keys(errors).length) throw ApiError.validation(errors);

  const raceByName = new Map(races.map((r) => [r.name, r]));
  const raceNameById = new Map(races.map((r) => [String(r._id), r.name]));
  const counts: RaceCounts = new Map();
  let subtotal = 0;
  for (const p of input.participants) {
    const race = raceByName.get(p.race)!;
    const raceId = String(race._id);
    counts.set(raceId, (counts.get(raceId) ?? 0) + 1);
    subtotal += race.price;
  }
  const d = input.delivery;
  const shippingFee = d.method === "shipping" ? env.SHIPPING_FEE : 0;
  const amount = subtotal + shippingFee;
  const expiresAt = new Date(Date.now() + env.ORDER_EXPIRE_HOURS * MS_PER_HOUR);

  for (let attempt = 0; ; attempt++) {
    const orderNo = generateOrderNo();
    try {
      await withTransaction(async (session) => {
        await reserveQuota(counts, raceNameById, session);
        const [order] = await Order.create(
          [
            {
              orderNo,
              eventId: event._id,
              contactName: d.contact.trim(),
              contactPhone: cleanPhone(d.phone),
              contactEmail: optionalText(d.email),
              delivery: d.method,
              address: addressOf(d),
              subtotal,
              shippingFee,
              amount,
              status: "pending",
              expiresAt,
              raceCounts: [...counts.entries()].map(([raceId, count]) => ({
                raceId,
                count,
              })),
            },
          ],
          { session },
        );
        await Participant.insertMany(
          input.participants.map((p) =>
            participantRecord(
              p,
              raceByName.get(p.race)!,
              order._id,
              event._id,
            ),
          ),
          { session },
        );
      });
      return {
        orderNo,
        status: "pending" as const,
        amount: { subtotal, shipping: shippingFee, total: amount },
        expiresAt,
      };
    } catch (err) {
      // The transaction already rolled back; retry with a new order number.
      if (isOrderNoCollision(err) && attempt < ORDER_NO_RETRIES) continue;
      throw err;
    }
  }
}
