export function summarizeDrillHistory(values: number[]) {
  const latest = values[values.length - 1];
  const baseline = values.slice(0, -1);
  const mean = baseline.reduce((sum, value) => sum + value, 0) / baseline.length;
  const deviation = Math.sqrt(baseline.reduce((sum, value) => sum + (value - mean) ** 2, 0) / baseline.length);
  const sorted = [...baseline].sort((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.ceil(sorted.length * p) - 1];
  const peak = values.reduce((idx, value, i) => value > values[idx] ? i : idx, 0);
  const delta = latest - mean;
  const score = deviation > 0 ? delta / deviation : null;
  return {
    latest, mean, delta, score, peak, p10: percentile(0.1), median: percentile(0.5), p90: percentile(0.9),
    sampleSize: baseline.length, lower: Math.max(0, mean - 3 * deviation), upper: mean + 3 * deviation,
    flagged: score !== null && Math.abs(score) >= 3,
  };
}
