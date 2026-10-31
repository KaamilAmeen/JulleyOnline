/** Spacing used when appending a task/column at the end of a list. */
export const POSITION_GAP = 1024;

/**
 * Fractional indexing: returns a position strictly between `prev` and `next`.
 * Returns `null` when the gap is too small and the caller should rebalance.
 */
export function positionBetween(prev: number | null | undefined, next: number | null | undefined): number | null {
  if (prev == null && next == null) return POSITION_GAP;
  if (prev == null && next != null) return next / 2;
  if (prev != null && next == null) return prev + POSITION_GAP;
  if (prev != null && next != null) {
    if (next - prev <= 0.0001) return null;
    return prev + (next - prev) / 2;
  }
  return POSITION_GAP;
}

/** Evenly spaced positions for a column that needs rebalancing. */
export function rebalancedPositions(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 1) * POSITION_GAP);
}
