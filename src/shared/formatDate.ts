/**
 * Locale-free date formatting.
 *
 * Hermes (React Native's real JS engine) does not implement
 * `Date.prototype.toLocaleDateString`/`toLocaleString` without a full ICU
 * build compiled in, which this project does not enable — throws
 * `TypeError: date.toLocaleDateString is not a function` at render time.
 * Node.js (where Jest runs) implements both fully, so every unit test using
 * these methods passed while the real app crashed on every repository list
 * item and every repository details screen. Only caught by running the
 * actual app on a simulator. See docs/BUGS.md.
 *
 * These are deliberately simple/manual instead of reaching for `Intl.*`
 * directly, for the same reason: Hermes's `Intl` support is similarly
 * ICU-dependent and not guaranteed available without extra build
 * configuration this project doesn't have.
 */

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function formatDate(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatDateTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${formatDate(date)}, ${displayHours}:${minutes} ${period}`;
}
