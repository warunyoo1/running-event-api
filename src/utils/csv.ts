export const CSV_BOM = "\uFEFF";

/** Neutralise spreadsheet formula injection: prefix risky text cells with `'`. */
export function safeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function toCsv(rows: unknown[][]): string {
  const body = rows
    .map((row) =>
      row.map((v) => `"${safeCell(v).replaceAll('"', '""')}"`).join(","),
    )
    .join("\r\n");
  return CSV_BOM + body + (rows.length ? "\r\n" : "");
}
