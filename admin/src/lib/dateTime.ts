// Dates and times shown to customers use India's calendar and 12-hour clock.
export function formatDateOnly(value?: string | null): string {
  if (!value) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return '-';
    return calendarDate(date, 'UTC');
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return calendarDate(date, 'Asia/Kolkata');
}

function calendarDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return part('weekday') + ', ' + part('day') + ' ' + part('month')?.slice(0, 3) + ' ' + part('year');
}

export function formatTime(value?: string | null): string {
  if (!value) return '-';
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2})(?::\d{2})?)?\s*(am|pm)?$/i);
  if (!match || (!match[2] && !match[3])) return value;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '00');
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return value;
  if (match[3]) hour = hour % 12 + (match[3].toLowerCase() === 'pm' ? 12 : 0);
  return String(hour % 12 || 12) + ':' + String(minute).padStart(2, '0') + (hour >= 12 ? ' PM' : ' AM');
}

export function formatTimeSlot(value?: string | null): string {
  if (!value) return '-';
  return value.replace(/\b(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?|\d{1,2}\s*[ap]m)\b/gi, time => formatTime(time)).replace(/\s*[-–]\s*/g, ' – ');
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDateOnly(value);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return formatDateOnly(value) + ', ' + formatTime(time);
}
