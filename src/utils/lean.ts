/**
 * API view of a `.lean()` document. Lean results skip the `cleanJson` toJSON plugin,
 * so this does the same by hand: `_id` becomes `id` (always the first key), `__v`
 * and any `omit` keys are dropped, and the remaining keys keep their stored order.
 */
export function withId<T extends { _id: unknown }, K extends keyof T = never>(
  doc: T,
  omit: readonly K[] = [],
): { id: string } & Omit<T, "_id" | "__v" | K> {
  const { _id, ...rest } = doc;
  const fields: Record<PropertyKey, unknown> = rest;
  delete fields.__v;
  for (const key of omit) delete fields[key];
  return { id: String(_id), ...(fields as Omit<T, "_id" | "__v" | K>) };
}
