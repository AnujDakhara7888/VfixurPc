import { formatCustomerDates } from './dateTime';

describe('Customer message dates', () => {
  it.each([
    ['Appointment 2026-09-13 at 12:30', 'Appointment Sun, 13 Sep 2026 at 12:30 PM'],
    ['2026-09-13T07:00:00Z', 'Sun, 13 Sep 2026 · 12:30 PM'],
    ['2026-09-12T20:00:00Z', 'Sun, 13 Sep 2026 · 1:30 AM'],
    ['2026-09-13 09:00 - 12:00', 'Sun, 13 Sep 2026 9:00 AM – 12:00 PM'],
    ['9am - 1pm', '9:00 AM – 1:00 PM'],
    ['00:00', '12:00 AM'],
    ['Appointment 13/09/2026 at 1pm', 'Appointment Sun, 13 Sep 2026 at 1:00 PM'],
    ['Meet at 12:30 tomorrow', 'Meet at 12:30 PM tomorrow'],
    ['Sun, 13 Sep 2026 · 12:30 PM', 'Sun, 13 Sep 2026 · 12:30 PM'],
    ['Ticket VFIX-20260913-1234; 48 hours', 'Ticket VFIX-20260913-1234; 48 hours'],
    ['Invalid 2026-02-31 and 25:00', 'Invalid 2026-02-31 and 25:00'],
  ])('formats %s', (input, expected) => {
    expect(formatCustomerDates(input)).toBe(expected);
  });
});
