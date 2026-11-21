import type { HeatBucketDetail } from "./types";

export function prepareHotnessData(heatScores: number[], bucketDetails: HeatBucketDetail[]) {
  const candidates = heatScores.length > 1 ? heatScores.slice(0, -1) : heatScores;
  const byIndex = new Map(bucketDetails.map(detail => [detail.bucketIndex, detail]));
  const details = candidates.map((score, index) => {
    const detail = byIndex.get(index);
    if (!Number.isFinite(score) || !detail?.metrics.length
      || detail.metrics.some(metric => !Number.isFinite(metric.value) || !Number.isFinite(metric.zScore))) return undefined;
    if (detail.metrics.every(metric => metric.value === 0)) return undefined;
    return detail;
  });
  const scores = candidates.map((score, index) => details[index] ? score : null);
  const ranked = scores.flatMap((z, i) => z === null ? [] : [{ z, i }]).sort((a, b) => b.z - a.z);
  const validDetails = details.filter((detail): detail is HeatBucketDetail => detail !== undefined);
  return { scores, details, ranked, validDetails, excludedCount: candidates.length - ranked.length };
}

export function hotnessTrend(scores: (number | null)[]): number {
  const points = scores.flatMap((y, x) => y === null ? [] : [{ x, y }]);
  const n = points.length;
  if (n < 2) return 0;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumX2 = points.reduce((sum, point) => sum + point.x * point.x, 0);
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

export function hotnessEpisodes(scores: (number | null)[], threshold = 0.75) {
  const episodes: { startIdx: number; endIdx: number; bucketCount: number }[] = [];
  let start: number | undefined;
  for (let i = 0; i <= scores.length; i++) {
    const value = scores[i];
    if (value != null && value >= threshold) {
      if (start === undefined) start = i;
    } else if (start !== undefined) {
      episodes.push({ startIdx: start, endIdx: i - 1, bucketCount: i - start });
      start = undefined;
    }
  }
  const recoveries = episodes.flatMap(episode => {
    for (let i = episode.endIdx + 1; i < scores.length; i++) {
      const score = scores[i];
      if (score === null) break;
      if (score < 0.3 || score >= threshold) return [i - episode.endIdx];
    }
    return [];
  });
  return {
    episodes,
    maxRun: episodes.reduce((longest, episode) => Math.max(longest, episode.bucketCount), 0),
    avgRecoveryBuckets: recoveries.length ? Math.round(recoveries.reduce((sum, count) => sum + count, 0) / recoveries.length) : 0,
  };
}
