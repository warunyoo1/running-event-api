import type { OrderNoteLean } from "../models/order-note.model";

export interface OrderNoteView {
  id: string;
  orderId: string;
  text: string;
  createdAt: Date;
  author: { id: string; name: string } | null;
}

/** `names` maps user id to display name; an unknown (deleted) author gives `author: null`. */
export const toOrderNoteView = (
  note: OrderNoteLean,
  names: ReadonlyMap<string, string>,
): OrderNoteView => {
  const authorId = String(note.authorId);
  const name = names.get(authorId);
  return {
    id: String(note._id),
    orderId: String(note.orderId),
    text: note.text,
    createdAt: note.createdAt,
    author: name === undefined ? null : { id: authorId, name },
  };
};
