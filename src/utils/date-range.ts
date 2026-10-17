/** Today in Asia/Bangkok as YYYY-MM-DD. */
export function bangkokToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Convert Bangkok YYYY-MM-DD bounds to a Mongo createdAt range (inclusive). */
export function bangkokRange(
  from?: string,
  to?: string,
): { $gte?: Date; $lte?: Date } | undefined {
  const range: { $gte?: Date; $lte?: Date } = {};
  if (from) range.$gte = new Date(`${from}T00:00:00.000+07:00`);
  if (to) range.$lte = new Date(`${to}T23:59:59.999+07:00`);
  return from || to ? range : undefined;
}
