export function matchesRange(value, { mode, min = '', max = '' }) {
  if (mode === 'any') return true;
  if (min === '' && (mode !== 'between' || max === '')) return true;
  if (value == null || !Number.isFinite(value)) return false;
  const low = min === '' ? null : Number(min), high = max === '' ? null : Number(max);
  if ((low !== null && (!Number.isFinite(low) || low < 0)) || (high !== null && (!Number.isFinite(high) || high < 0))) return false;
  if (mode === 'bucket') return (low === 0 ? value >= 0 : value > low) && (high === null || value <= high);
  if (mode === 'between') return (low === null || value >= low) && (high === null || value <= high);
  if (mode === 'eq') return Math.abs(value - low) < 1e-9;
  if (mode === 'lt') return value < low;
  if (mode === 'lte') return value <= low;
  if (mode === 'gt') return value > low;
  if (mode === 'gte') return value >= low;
  return true;
}
