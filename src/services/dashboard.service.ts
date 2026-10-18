import { Types } from "mongoose";
import { EventModel, Order, Race } from "../models";
import { toDashboardView, type DashboardView } from "../views/dashboard.view";

export async function get(eventId?: string): Promise<DashboardView> {
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
  return toDashboardView(byStatus, revenueRows[0]?.revenue ?? 0, races, evName);
}
