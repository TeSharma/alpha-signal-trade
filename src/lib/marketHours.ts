export function isForexMarketOpen(date = new Date()): boolean {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();

  if (day === 6) return false;
  if (day === 0) return hour >= 22;
  if (day === 5) return hour < 22;

  return true;
}