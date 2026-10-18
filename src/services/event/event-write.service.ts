import { Types } from "mongoose";
import { EventModel, Order, Race } from "../../models";
import { ApiError } from "../../utils/api-error";
import { runUndo, type Undo } from "../../utils/compensation";
import type { EventBody } from "../../validators/event.validator";
import type { AdminEventView } from "../../views/event.view";
import { audit } from "../audit.service";
import { QUOTA_HOLDING } from "../order/order-state";
import { eventNotFound } from "../service-errors";
import { getAdmin } from "./event-read.service";
function eventFields(body: EventBody) {
  const { races: _races, ...fields } = body;
  return fields;
}

const slugTaken = () => ApiError.conflict("SLUG_TAKEN", "slug นี้ถูกใช้แล้ว");

export async function create(
  actorId: string,
  body: EventBody,
): Promise<AdminEventView> {
  if (await EventModel.exists({ slug: body.slug })) throw slugTaken();
  // No transaction: saving a form must work on a standalone MongoDB. Instead the event id is generated
  // up front, the races are written first and the event document LAST (it is the commit point: nothing
  // lists a race without its event). If any step fails, the races written so far are deleted.
  // Residual risk: if the process dies or the DB drops between the two writes (or the cleanup itself
  // fails, which is logged) unreferenced races stay behind; they are invisible and harmless.
  const eventId = new Types.ObjectId();
  const id = String(eventId);
  const undo: Undo[] = [
    {
      label: `delete races of new event ${id}`,
      run: () => Race.deleteMany({ eventId, reserved: 0 }),
    },
  ];
  try {
    await Race.create(
      body.races.map((r, i) => ({
        eventId,
        name: r.name,
        price: r.price,
        quota: r.quota,
        start: r.start,
        sortOrder: i,
      })),
      { ordered: true },
    );
    await EventModel.create({ ...eventFields(body), _id: eventId });
  } catch (err) {
    await runUndo(undo);
    throw err;
  }
  await audit(actorId, "event.create", "Event", id, { slug: body.slug });
  return getAdmin(id);
}

const quotaBelowReserved = (i: number) =>
  ApiError.validation({
    [`races.${i}.quota`]: "โควตาต้องไม่น้อยกว่าจำนวนที่จองแล้ว",
  });

/**
 * Applies the race list of an event update WITHOUT a transaction (must work on standalone MongoDB).
 * - All validation runs first, before any write.
 * - A concurrent order cannot slip in between the hasOrders check and the writes: every write that
 *   would be unsafe with reservations is a conditional single-document update on `reserved`
 *   (`reserved: 0` for price/name/removal, `reserved <= quota` for quota), and a miss aborts.
 * - Each write registers its inverse in `undo` BEFORE it runs; the caller runs `undo` if anything
 *   later fails, so no partial change is left behind.
 * Residual risk: a crash between writes (or a failing cleanup, which is logged) can leave a partly
 * applied race list; re-saving the event form fixes it.
 */
async function updateRaces(
  id: string,
  races: EventBody["races"],
  undo: Undo[],
): Promise<void> {
  const existing = await Race.find({ eventId: id });
  const hasOrders = !!(await Order.exists({
    eventId: id,
    status: { $in: [...QUOTA_HOLDING] },
  }));
  const locked = (msg: string) => ApiError.conflict("EVENT_HAS_ORDERS", msg);

  // Match incoming races to existing ones: by id when given, otherwise by name (also revives inactive races).
  const byId = new Map(existing.map((r) => [String(r._id), r]));
  const byName = new Map(existing.map((r) => [r.name, r]));
  const matched = races.map((r) =>
    r.id ? byId.get(r.id) : byName.get(r.name),
  );
  if (races.some((r, i) => r.id && !matched[i]))
    throw ApiError.validation({ races: "ไม่พบระยะที่ระบุ" });
  const keptIds = new Set(matched.filter(Boolean).map((r) => String(r!._id)));

  if (hasOrders) {
    races.forEach((r, i) => {
      const m = matched[i];
      if (m && m.active && (m.price !== r.price || m.quota !== r.quota))
        throw locked("มีออเดอร์แล้ว ไม่สามารถแก้ราคาหรือโควตาของระยะได้");
      if (m && m.name !== r.name)
        throw locked("มีออเดอร์แล้ว ไม่สามารถเปลี่ยนชื่อระยะได้");
    });
    if (existing.some((r) => r.active && !keptIds.has(String(r._id))))
      throw locked("มีออเดอร์แล้ว ไม่สามารถลบระยะได้");
  }
  races.forEach((r, i) => {
    const m = matched[i];
    if (m && r.quota < m.reserved) throw quotaBelowReserved(i);
  });

  // Deactivate removed races (only reachable when there are no active orders).
  const removed = existing
    .filter((r) => r.active && !keptIds.has(String(r._id)))
    .map((r) => r._id);
  if (removed.length > 0) {
    undo.push({
      label: "reactivate removed races",
      run: () =>
        Race.updateMany({ _id: { $in: removed } }, { $set: { active: true } }),
    });
    const res = await Race.updateMany(
      { _id: { $in: removed }, reserved: 0 },
      { $set: { active: false } },
    );
    if (res.matchedCount !== removed.length)
      throw locked("มีออเดอร์แล้ว ไม่สามารถลบระยะได้");
  }
  for (const [i, r] of races.entries()) {
    const m = matched[i];
    const set = {
      name: r.name,
      price: r.price,
      quota: r.quota,
      start: r.start,
      sortOrder: i,
      active: true,
    };
    if (!m) {
      const raceId = new Types.ObjectId();
      undo.push({
        label: `delete new race ${raceId}`,
        run: () => Race.deleteOne({ _id: raceId, reserved: 0 }),
      });
      await Race.create([{ _id: raceId, eventId: id, ...set }]);
      continue;
    }
    // Snapshot for the inverse write (restoring is guarded so it can never push quota below reserved).
    const before = {
      name: m.name,
      price: m.price,
      quota: m.quota,
      start: m.start,
      sortOrder: m.sortOrder,
      active: m.active,
    };
    undo.push({
      label: `restore race ${m._id}`,
      run: () =>
        Race.updateOne(
          { _id: m._id, reserved: { $lte: before.quota } },
          { $set: before },
        ),
    });
    // Changing price/name of a race that is in use is only allowed while nothing is reserved.
    const sensitive =
      before.active && (before.name !== r.name || before.price !== r.price);
    // The reserved filter keeps the rules atomic with the write.
    const res = await Race.updateOne(
      { _id: m._id, reserved: sensitive ? 0 : { $lte: r.quota } },
      { $set: set },
    );
    if (res.matchedCount === 0)
      throw sensitive
        ? locked("มีออเดอร์แล้ว ไม่สามารถแก้ราคาหรือโควตาของระยะได้")
        : quotaBelowReserved(i);
  }
}

export async function update(
  actorId: string,
  id: string,
  body: EventBody,
): Promise<AdminEventView> {
  const event = await EventModel.findOne({ _id: id, archived: false });
  if (!event) throw eventNotFound();
  if (
    body.slug !== event.slug &&
    (await EventModel.exists({ slug: body.slug, _id: { $ne: id } }))
  ) {
    throw slugTaken();
  }

  const undo: Undo[] = [];
  try {
    await updateRaces(id, body.races, undo);
    await EventModel.updateOne({ _id: id }, { $set: eventFields(body) });
  } catch (err) {
    await runUndo(undo);
    throw err;
  }
  await audit(actorId, "event.update", "Event", id, { slug: body.slug });
  return getAdmin(id);
}
