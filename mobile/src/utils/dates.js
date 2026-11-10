// Dates travel to the API as "YYYY-MM-DD" (DateOnly), built from the device's local calendar.

export function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function fromIsoDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(value, days) {
  const date = fromIsoDate(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function nightsBetween(checkIn, checkOut) {
  return Math.round((fromIsoDate(checkOut) - fromIsoDate(checkIn)) / 86400000);
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// "2026-11-10" -> "T3, 10/11/2026"
export function displayDate(value) {
  if (!value) return '';
  const date = fromIsoDate(value);
  return `${WEEKDAYS[date.getDay()]}, ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

// "25/12/1995" -> "1995-12-25", or null when it is not a real past date.
export function parseVnDate(text) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d || date > new Date()) return null;
  return toIsoDate(date);
}

export function ageOn(isoBirthDate, today = new Date()) {
  const birth = fromIsoDate(isoBirthDate);
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}
