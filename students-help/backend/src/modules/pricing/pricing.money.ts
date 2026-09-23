/** Round a non-negative integer division to nearest, with halves rounding away from zero. */
export function roundDiv(numerator: number, denominator: number): number {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
    throw new RangeError('roundDiv requires integer numerator and positive integer denominator.');
  }
  const sign = numerator < 0 ? -1 : 1;
  const abs = Math.abs(numerator);
  return sign * Math.trunc((abs + Math.trunc(denominator / 2)) / denominator);
}
