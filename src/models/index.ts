import { AuditLog } from "./audit-log.model";
import { EventModel } from "./event.model";
import { Order } from "./order.model";
import { Participant } from "./participant.model";
import { Payment } from "./payment.model";
import { Race } from "./race.model";
import { User } from "./user.model";

export { AuditLog, EventModel, Order, Participant, Payment, Race, User };

/** Creates all indexes (idempotent). */
export async function syncAllIndexes() {
  await Promise.all([AuditLog, EventModel, Order, Participant, Payment, Race, User].map((m) => m.syncIndexes()));
}
