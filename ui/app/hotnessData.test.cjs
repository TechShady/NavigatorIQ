const { test } = require("node:test");
const assert = require("node:assert/strict");
const { prepareHotnessData, hotnessTrend, hotnessEpisodes } = require("./hotnessData.ts");

function bucket(bucketIndex, traffic, errors = 0, zScore = 0) {
  const metrics = [{ label: "Errors", value: errors, zScore, displayValue: String(errors) }];
  if (traffic !== undefined) metrics.unshift({ label: "Sessions", value: traffic, zScore: 0, displayValue: String(traffic), isTraffic: true });
  return { bucketIndex, zScore, level: "normal", metrics };
}

test("no-data buckets cannot become W1/W2 or B1/B2 and are omitted from timeline data", () => {
  const data = prepareHotnessData(
    [2, 0, 0.1, 0, 1, 99],
    [bucket(0, 10, 4), bucket(1, 0), bucket(2, 12), bucket(3, 0), bucket(4, 8, 2), bucket(5, 5, 1)],
  );
  assert.deepEqual(data.ranked.map(({ i }) => i), [0, 4, 2]);
  assert.deepEqual(data.scores, [2, null, 0.1, null, 1]);
  assert.deepEqual(data.validDetails.map(detail => detail.bucketIndex), [0, 2, 4]);
  assert.equal(data.excludedCount, 2);
  assert.equal(data.details[data.ranked.at(-1).i].metrics[0].value, 12);
});

test("individual zero values are retained when the bucket has other data", () => {
  const data = prepareHotnessData([0, 0, 0, 0], [
    bucket(0, 10), bucket(1, undefined), bucket(2, 0, 1), bucket(3, 0),
  ]);
  assert.deepEqual(data.scores, [0, null, 0]);
  assert.equal(data.ranked.length, 2);
});

test("all-zero mobile buckets are excluded even when Sessions is not marked as traffic", () => {
  const details = [bucket(0, 273, 379), bucket(1, 150, 100), bucket(2, 0), bucket(3, 0), bucket(4, 0)];
  for (const detail of details) {
    detail.metrics.forEach(metric => { delete metric.isTraffic; });
    for (const label of ["Error Rate", "Crashes", "Crash Rate"]) {
      detail.metrics.push({ label, value: 0, zScore: -0.5, displayValue: "0" });
    }
  }
  const data = prepareHotnessData([2.34, 0.1, 0, 0, 0], details);
  assert.deepEqual(data.ranked.map(({ i }) => i), [0, 1]);
  assert.deepEqual(data.scores, [2.34, 0.1, null, null]);
  assert.deepEqual(data.validDetails.map(detail => detail.bucketIndex), [0, 1]);
  assert.equal(data.excludedCount, 2);
  assert.equal(data.ranked.at(-1).i, 1);
});

test("missing and invalid buckets are excluded using original bucket identities", () => {
  const invalid = bucket(1, 5, NaN);
  const data = prepareHotnessData([1, 0, 0.2, 0, Infinity, 4], [
    bucket(3, 7), invalid, bucket(0, 2, 1), bucket(4, 10), bucket(5, 2),
  ]);
  assert.deepEqual(data.scores, [1, null, null, 0, null]);
  assert.deepEqual(data.validDetails.map(detail => detail.bucketIndex), [0, 3]);
  assert.equal(data.ranked.at(-1).i, 3);
  const empty = prepareHotnessData([0, 0, 0], [bucket(0, 0), bucket(1, 0), bucket(2, 0)]);
  assert.deepEqual(empty.ranked, []);
  assert.deepEqual(empty.validDetails, []);
  assert.deepEqual(prepareHotnessData([], []).scores, []);
});

test("gaps break spike episodes and cannot count as recovery", () => {
  const result = hotnessEpisodes([1, 2, null, 1, 0.2]);
  assert.deepEqual(result.episodes, [
    { startIdx: 0, endIdx: 1, bucketCount: 2 },
    { startIdx: 3, endIdx: 3, bucketCount: 1 },
  ]);
  assert.equal(result.maxRun, 2);
  assert.equal(result.avgRecoveryBuckets, 1);
  assert.equal(hotnessEpisodes([1, null, 0]).avgRecoveryBuckets, 0);
  assert.equal(hotnessEpisodes([1, null, 1]).maxRun, 1);
  assert.equal(hotnessEpisodes([1, null, null]).avgRecoveryBuckets, 0);
});

test("drift ignores missing buckets without compressing elapsed time", () => {
  assert.equal(hotnessTrend([1, null, null, 4]), 1);
  assert.equal(hotnessTrend([2, null, 2, null, null]), 0);
  assert.equal(hotnessTrend([null, null]), 0);
  assert.equal(hotnessTrend([null, 1]), 0);
});
