export function formatBirthdayInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}-${month}`;
  return `${day}-${month}-${year}`;
}

export function birthdayToIso(value: string, now = new Date()): string | undefined {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return undefined;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() + 1 !== month
    || candidate.getUTCDate() !== day
    || candidate > today
  ) {
    return undefined;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}
