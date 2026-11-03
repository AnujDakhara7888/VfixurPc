export function calendarLink(
  date?: string,
  slot?: string,
  title = "VfixurPC appointment",
  location = "",
  details = "",
) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const times = slot?.match(/\b\d{1,2}:\d{2}(?:\s*[AP]M)?/gi);
  const day = date.replace(/-/g, "");
  const compact = (v: string) => {
    const match = v.match(/(\d{1,2}):(\d{2})\s*([AP]M)?/i)!;
    let hour = Number(match[1]);
    if (match[3])
      hour = (hour % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
    return String(hour).padStart(2, "0") + match[2] + "00";
  };
  // Legacy labels without actual times become all-day events.
  const start = times?.length === 2 ? day + "T" + compact(times[0]) : day;
  const end =
    times?.length === 2
      ? day + "T" + compact(times[1])
      : new Date(Date.parse(date + "T00:00:00Z") + 86400000)
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "");
  return (
    "https://calendar.google.com/calendar/render?" +
    new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: start + "/" + end,
      ctz: "Asia/Kolkata",
      location,
      details,
    }).toString()
  );
}
