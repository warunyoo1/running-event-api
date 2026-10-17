import { Types } from "mongoose";
import { orderStatuses } from "../config/constants";
import { EventModel, Order, Race } from "../models";

export async function get(eventId?: string) {
  const match = eventId ? { eventId: new Types.ObjectId(eventId) } : {};
  const [byStatus, revenueRows, races] = await Promise.all([
    Order.aggregate<{ _id: string; n: number }>([
      { $match: match },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    Order.aggregate<{ _id: null; revenue: number }>([
      { $match: { ...match, status: "paid" } },
      { $group: { _id: null, revenue: { $sum: "$amount" } } },
    ]),
    Race.find({ ...(eventId ? { eventId } : {}), active: true })
      .sort({ eventId: 1, sortOrder: 1 })
      .lean(),
  ]);
  const events = await EventModel.find({
    _id: { $in: races.map((r) => r.eventId) },
  })
    .select("name")
    .lean();
  const evName = new Map(events.map((e) => [String(e._id), e.name]));
  const orders = Object.fromEntries(
    orderStatuses.map((s) => [s, byStatus.find((b) => b._id === s)?.n ?? 0]),
  );
  return {
    orders,
    totalOrders: Object.values(orders).reduce((a, b) => a + b, 0),
    pendingReview: orders.slip_uploaded,
    paidRevenue: revenueRows[0]?.revenue ?? 0,
    // Seats held by quota-holding orders (pending/slip_uploaded/rejected included, not just paid).
    participants: races.reduce((a, r) => a + r.reserved, 0),
    races: races.map((r) => ({
      raceId: String(r._id),
      eventId: String(r.eventId),
      eventName: evName.get(String(r.eventId)) ?? "",
      name: r.name,
      price: r.price,
      quota: r.quota,
      reserved: r.reserved,
      remaining: Math.max(0, r.quota - r.reserved),
    })),
  };
}
