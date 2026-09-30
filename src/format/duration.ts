// How long something has been open, share-card style: 56M, 3H 5M, 2D.
export function heldFor(sinceUnixMs: number): string {
  const mins = Math.max(0, Math.floor((Date.now() - sinceUnixMs) / 60_000));
  if (mins < 60) return `${mins}M`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H ${mins % 60}M`;
  return `${Math.floor(hours / 24)}D`;
}
