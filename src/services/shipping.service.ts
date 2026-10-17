import type { FilterQuery, Types } from "mongoose";
import { EXPORT_LIMIT } from "../config/constants";
import { Order, Participant } from "../models";
import type { OrderDoc } from "../models/order.model";
import { groupBy } from "../utils/collections";
import { pageMeta, skipOf } from "../utils/pagination";
import type {
  ExportShippingQuery,
  ShippingQuery,
} from "../validators/admin.validator";

type Address = {
  street?: string | null;
  subdistrict?: string | null;
  district?: string | null;
  province?: string | null;
  postalCode?: string | null;
};

type LeanOrder = {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  orderNo: string;
  contactName: string;
  contactPhone: string;
  delivery: string;
  address?: Address | null;
  trackingProvider?: string | null;
  trackingNo?: string | null;
};

function filterOf(q: ExportShippingQuery): FilterQuery<OrderDoc> {
  const f: FilterQuery<OrderDoc> = { status: "paid" };
  if (q.eventId) f.eventId = q.eventId;
  if (q.method) f.delivery = q.method;
  return f;
}

async function build(orders: LeanOrder[]) {
  const participants = await Participant.find({
    orderId: { $in: orders.map((o) => o._id) },
  })
    .sort({ _id: 1 })
    .lean();
  const byOrder = groupBy(participants, (p) => String(p.orderId));
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

export async function list(q: ShippingQuery) {
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

export async function listForExport(q: ExportShippingQuery) {
  return build(
    await Order.find(filterOf(q))
      .sort({ paidAt: 1, _id: 1 })
      .limit(EXPORT_LIMIT)
      .lean(),
  );
}
