export type PageQuery = { page: number; pageSize: number };

export function pageMeta({ page, pageSize }: PageQuery, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export const skipOf = ({ page, pageSize }: PageQuery) => (page - 1) * pageSize;

/** Escape user text for use inside a RegExp. */
export const escapeRegex = (s: string) =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
