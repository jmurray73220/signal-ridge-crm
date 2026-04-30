/**
 * Calendar-day date helpers.
 *
 * Fields like task.dueDate, initiative.startDate, and initiative.targetDate
 * represent calendar days (no meaningful time-of-day). The server stores them
 * as ISO datetimes whose UTC moment is midnight of the typed day, which means
 * `new Date(field).toLocaleDateString()` and `getDate()` return the WRONG day
 * for any viewer west of UTC (e.g. EDT = April 30 stored → April 29 displayed).
 *
 * These helpers extract the YYYY-MM-DD prefix from the ISO string and treat
 * it as a calendar day, immune to the viewer's timezone. Use the regular
 * `new Date(...)` parsing for fields that are real timestamps (createdAt,
 * interaction.date, reminder.remindAt — those have meaningful clock times).
 */

/** Today as YYYY-MM-DD in the viewer's local timezone. */
export function todayYmd(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Extract the YYYY-MM-DD prefix from an ISO datetime string. */
export function ymd(d?: string | null): string {
  return d ? d.slice(0, 10) : '';
}

/**
 * Format a calendar-day field as a human label, parsing the YYYY-MM-DD as
 * local-tz midnight so the displayed day matches the day the user typed.
 */
export function formatCalendarDate(
  d?: string | null,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  if (!d) return '';
  const parts = d.slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return '';
  const [y, m, day] = parts;
  return new Date(y, m - 1, day).toLocaleDateString('en-US', opts);
}

/** True if the calendar day is strictly before today. */
export function isOverdueDay(d?: string | null): boolean {
  if (!d) return false;
  return d.slice(0, 10) < todayYmd();
}

/** True if the calendar day equals today. */
export function isTodayDay(d?: string | null): boolean {
  if (!d) return false;
  return d.slice(0, 10) === todayYmd();
}

/**
 * Calendar-day difference from today (negative = past, 0 = today, positive
 * = future). Returns null if the value is missing or unparseable.
 */
export function daysFromToday(d?: string | null): number | null {
  if (!d) return null;
  const parts = d.slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [y, m, day] = parts;
  const target = new Date(y, m - 1, day).getTime();
  const n = new Date();
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}
