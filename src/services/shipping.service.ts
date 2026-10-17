import type { FilterQuery } from "mongoose";
import { Order, Participant } from "../models";
import type { OrderDoc } from "../models/order.model";
import { pageMeta, skipOf } from "../utils/pagination";

type Q = { eventId?: string; method?: "pickup" | "shipping" };

function filterOf(q: Q): FilterQuery<OrderDoc> {
  const f: FilterQuery<OrderDoc> = { status: "paid" };
  if (q.eventId) f.eventId = q.eventId;
  if (q.method) f.delivery = q.method;
  return f;
}

async function build(orders: Array<Record<string, any>>) {
  const participants = await Participant.find({
    orderId: { $in: orders.map((o) => o._id) },
  })
    .sort({ _id: 1 })
    .lean();
  const byOrder = new Map<string, typeof participants>();
  for (const p of participants)
    byOrder.set(String(p.orderId), [
      ...(byOrder.get(String(p.orderId)) ?? []),
      p,
    ]);
  return orders.map((o) => {
    const ps = byOrder.get(String(o._id)) ?? [];
    return {
      orderId: String(o._id),
      orderNo: o.orderNo,
      eventId: String(o.eventId),
      contactName: o.contactName,
      contactPhone: o.contactPhone,
      delivery: o.delivery,
      address: o.address ?? null,
      trackingProvider: o.trackingProvider ?? null,
      trackingNo: o.trackingNo ?? null,
      participants: ps.map((p) => ({
        id: String(p._id),
        name: `${p.firstName} ${p.lastName}`,
        race: p.raceName,
        size: p.size,
        bibNo: p.bibNo ?? null,
        collected: p.collected,
      })),
      allCollected: ps.length > 0 && ps.every((p) => p.collected),
    };
  });
}

export async function list(q: Q & { page: number; pageSize: number }) {
  const filter = filterOf(q);
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ paidAt: 1, _id: 1 })
      .skip(skipOf(q))
      .limit(q.pageSize)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { data: await build(orders), meta: pageMeta(q, total) };
}

export async function listForExport(q: Q) {
  return build(
    await Order.find(filterOf(q))
      .sort({ paidAt: 1, _id: 1 })
      .limit(50_000)
      .lean(),
  );
}
