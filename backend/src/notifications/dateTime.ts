// Normalize date/time tokens without attempting to parse arbitrary message prose.
export function formatCustomerDates(message: string): string {
  const legacyDates = message.replace(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g, (value, day, month, year) => {
    const iso = year + '-' + month + '-' + day;
    const parsed = new Date(iso + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : value;
  });
  const dates = legacyDates.replace(/\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?\b/g, value => {
    const dateOnly = value.length === 10;
    const date = new Date(dateOnly ? value + 'T00:00:00Z' : value);
    if (!Number.isFinite(date.getTime()) || (dateOnly && date.toISOString().slice(0, 10) !== value)) return value;
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: dateOnly ? 'UTC' : 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    }).formatToParts(date);
    const part = (type: string) => parts.find(p => p.type === type)?.value;
    const day = part('weekday') + ', ' + part('day') + ' ' + part('month')?.slice(0, 3) + ' ' + part('year');
    if (dateOnly) return day;
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
    return day + ' · ' + time;
  });
  return dates.replace(/\b(\d{1,2})(?::(\d{2})(?::\d{2})?)?(?:\s*([ap]m))?\b/gi, (value, hours, minutes, period) => {
    if (minutes === undefined && !period) return value;
    let hour = Number(hours);
    const minute = Number(minutes ?? 0);
    if (minute > 59 || (period ? hour < 1 || hour > 12 : hour > 23)) return value;
    if (period) hour = hour % 12 + (period.toLowerCase() === 'pm' ? 12 : 0);
    return String(hour % 12 || 12) + ':' + String(minute).padStart(2, '0') + (hour >= 12 ? ' PM' : ' AM');
  }).replace(/\b(AM|PM)\s*-\s*(?=\d)/g, '$1 – ');
}
