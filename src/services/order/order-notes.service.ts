import {
  HTTP_STATUS,
  ORDER_NOTES_MAX_PER_ORDER,
  type Role,
} from "../../config/constants";
import { OrderNote } from "../../models";
import { ApiError } from "../../utils/api-error";
import type { AdminOrderFullDetailView } from "../../views/order.view";
import { audit } from "../audit.service";
import { findOrderOr404, getAdmin } from "./order-admin.service";

export type NoteActor = { id: string; role: Role };

/** Append-only internal notes. The note text is never copied into the audit log. */
export async function addNote(
  actor: NoteActor,
  orderId: string,
  text: string,
): Promise<AdminOrderFullDetailView> {
  await findOrderOr404(orderId, "_id");
  // Soft cap (not atomic): two simultaneous requests could reach cap + 1.
  if ((await OrderNote.countDocuments({ orderId })) >= ORDER_NOTES_MAX_PER_ORDER)
    throw new ApiError(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      "NOTE_LIMIT_REACHED",
      `บันทึกครบ ${ORDER_NOTES_MAX_PER_ORDER} รายการแล้ว`,
    );
  const note = await OrderNote.create({ orderId, authorId: actor.id, text });
  await audit(actor.id, "order.note.add", "Order", orderId, {
    noteId: String(note._id),
  });
  return getAdmin(orderId);
}

/** A reviewer may delete only their own notes; a super_admin may delete any. */
export async function removeNote(
  actor: NoteActor,
  orderId: string,
  noteId: string,
): Promise<AdminOrderFullDetailView> {
  await findOrderOr404(orderId, "_id");
  const note = await OrderNote.findOne({ _id: noteId, orderId })
    .select("authorId")
    .lean();
  if (!note) throw ApiError.notFound("ไม่พบบันทึก", "NOTE_NOT_FOUND");
  const authorId = String(note.authorId);
  if (actor.role !== "super_admin" && authorId !== actor.id)
    throw ApiError.forbidden("ลบได้เฉพาะบันทึกของตัวเอง");
  await OrderNote.deleteOne({ _id: noteId, orderId });
  await audit(actor.id, "order.note.delete", "Order", orderId, {
    noteId,
    authorId,
  });
  return getAdmin(orderId);
}
