import type { FilterQuery } from "mongoose";
import { EXPORT_LIMIT } from "../config/constants";
import { Order, Participant } from "../models";
import type {
  ParticipantDoc,
  ParticipantLean,
} from "../models/participant.model";
import type { PageMeta } from "../types/api";
import { ApiError } from "../utils/api-error";
import { escapeRegex, pageMeta, skipOf } from "../utils/pagination";
import type {
  ExportParticipantsQuery,
  ParticipantsQuery,
  PatchParticipantBody,
} from "../validators/admin.validator";
import {
  toParticipantWithOrderView,
  type ParticipantWithOrderView,
} from "../views/participant.view";
import { audit } from "./audit.service";

async function buildFilter(
  f: ExportParticipantsQuery,
): Promise<FilterQuery<ParticipantDoc>> {
  const filter: FilterQuery<ParticipantDoc> = {};
  if (f.eventId) filter.eventId = f.eventId;
  if (f.race) filter.raceName = f.race;
  const and: FilterQuery<ParticipantDoc>[] = [];
  if (f.status) {
    const ids = await Order.distinct("_id", {
      status: f.status,
      ...(f.eventId ? { eventId: f.eventId } : {}),
    });
    and.push({ orderId: { $in: ids } });
  }
  if (f.q) {
    const re = new RegExp(escapeRegex(f.q), "i");
    const orderIds = await Order.distinct("_id", {
      orderNo: re,
      ...(f.eventId ? { eventId: f.eventId } : {}),
    });
    and.push({
      $or: [
        { firstName: re },
        { lastName: re },
        { bibNo: re },
        { orderId: { $in: orderIds } },
      ],
    });
  }
  if (and.length) filter.$and = and;
  return filter;
}

async function withOrders(
  rows: ParticipantLean[],
): Promise<ParticipantWithOrderView[]> {
  const orders = await Order.find({ _id: { $in: rows.map((r) => r.orderId) } })
    .select("orderNo status delivery")
    .lean();
  const map = new Map(orders.map((o) => [String(o._id), o]));
  return rows.map((p) =>
    toParticipantWithOrderView(p, map.get(String(p.orderId))),
  );
}

export async function list(
  q: ParticipantsQuery,
): Promise<{ data: ParticipantWithOrderView[]; meta: PageMeta }> {
  const filter = await buildFilter(q);
  const [rows, total] = await Promise.all([
    Participant.find(filter)
      .sort({ createdAt: -1, _id: 1 })
      .skip(skipOf(q))
      .limit(q.pageSize)
      .lean(),
    Participant.countDocuments(filter),
  ]);
  return { data: await withOrders(rows), meta: pageMeta(q, total) };
}

export async function listForExport(
  f: ExportParticipantsQuery,
): Promise<ParticipantWithOrderView[]> {
  const rows = await Participant.find(await buildFilter(f))
    .sort({ createdAt: -1, _id: 1 })
    .limit(EXPORT_LIMIT)
    .lean();
  return withOrders(rows);
}

export async function patch(
  actorId: string,
  id: string,
  body: PatchParticipantBody,
): Promise<ParticipantWithOrderView> {
  const participant = await Participant.findById(id);
  if (!participant)
    throw ApiError.notFound("ไม่พบผู้สมัคร", "PARTICIPANT_NOT_FOUND");
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  if (body.bibNo !== undefined) {
    if (body.bibNo === null) unset.bibNo = "";
    else {
      const order = await Order.findById(participant.orderId).select("status");
      if (order?.status !== "paid")
        throw ApiError.conflict(
          "INVALID_STATE",
          "กำหนดเลข BIB ได้เฉพาะออเดอร์ที่ชำระเงินแล้ว",
        );
      set.bibNo = body.bibNo;
    }
  }
  if (body.collected !== undefined) {
    set.collected = body.collected;
    if (body.collected) set.collectedAt = new Date();
    else unset.collectedAt = "";
  }
  const update: Record<string, unknown> = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  if (Object.keys(update).length)
    await Participant.updateOne({ _id: id }, update); // E11000 -> DUPLICATE_BIB via error handler
  await audit(actorId, "participant.patch", "Participant", id, body);
  const fresh = await Participant.findById(id).lean();
  return (await withOrders([fresh!]))[0];
}
