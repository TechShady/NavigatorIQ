const { test } = require("node:test");
const assert = require("node:assert/strict");
const { QueryExecutionClient } = require("@dynatrace-sdk/client-query");
const { DEFAULT_HEAT_METRICS } = require("./constants.ts");
const { buildEntityBreakdownQuery } = require("./queries.ts");
const { summarizeDrillHistory } = require("./drillHistory.ts");
const { buildDqlDrilldownQuery, parseDqlDrilldownRecords, isMobileSessionDrilldown, getMobileErrorDrilldownFrontend, buildMobileErrorDetailQuery, mobileSessionHistoryWindow, buildMobileSessionDetailQuery, parseMobileSessionHistory, buildDqlDetailQuery, parseDqlHistory, resolveDqlTimeframeEnd, dqlHistoryChunks, aggregateDqlDimensions } = require("./queries.ts");

test("service breakdown accepts the saved entityName dimension and returns the raw entity ID", () => {
  const query = buildEntityBreakdownQuery("dt.service.request.response_time", "dt.entity.service", "now()-2h", "now()", 0.000001, "entityName(dt.entity.service)");
  assert.match(query, /by:\{dt\.entity\.service\}/);
  assert.match(query, /entityId=toString\(dt\.entity\.service\), displayName=coalesce\(entityName\(dt\.entity\.service\)/);
  assert.match(query, /avg=val \* 0\.000001/);
});

test("service breakdown supports multiple fields and uses total requests for error rates", () => {
  const query = buildEntityBreakdownQuery("dt.service.request.failure_rate", "dt.entity.service", "now()-2h", "now()", 1, "dt.entity.service, endpoint.name");
  assert.match(query, /by:\{dt\.entity\.service, endpoint\.name\}/);
  assert.match(query, /displayName=concat\(.*" \/ ".*toString\(endpoint\.name\)/);
  assert.match(query, /requests=sum\(dt\.service\.request\.count, scalar:true\)/);
  assert.match(query, /if\(requests > 0, failures \* 100\.0 \/ requests\)/);
  assert.throws(() => buildEntityBreakdownQuery("dt.service.request.count", "dt.entity.service", "now()-2h", "now()", 1, "entityName(dt.entity.service).handler"), /must be metric field names/);
});

test("anomaly review uses prior buckets only and does not score a flat baseline", () => {
  const history = summarizeDrillHistory([9, 10, 11, 10, 20]);
  assert.equal(history.mean, 10);
  assert.equal(history.sampleSize, 4);
  assert.equal(history.median, 10);
  assert.equal(history.peak, 4);
  assert.equal(history.flagged, true);
  assert.equal(summarizeDrillHistory([10, 10, 12]).score, null);
});

const sessionMetric = {
  label: "Sessions",
  metricKey: "",
  aggregation: "avg",
  type: "dql",
  dimensionConfig: { dimensions: "frontend.name" },
  dqlQuery: `fetch user.sessions, from:\${from}, to:\${to}
| filter dt.rum.application.type == "mobile"
| makeTimeseries value=count(), interval:\${interval}, time:start_time`,
};
const errorMetric = {
  label: "Errors",
  metricKey: "",
  aggregation: "sum",
  type: "dql",
  dqlQuery: `timeseries value = sum(dt.frontend.error.count),
  filter: frontend.name == "L1168_mobile",
  from: \${from},
  to: \${to},
  interval: \${interval}`,
  drilldownQuery: `timeseries value = sum(dt.frontend.error.count, scalar: true),
  by: {frontend.name, error.type},
  filter: frontend.name == "L1168_mobile",
  from: \${from},
  to: \${to}
| fields displayName = concat(frontend.name, " / ", coalesce(error.type, "Unknown")), value
| sort value desc`,
};

test("builds the mobile session breakdown for the configured timeframe", () => {
  const query = buildDqlDrilldownQuery(sessionMetric, "now()-2h", "now()", "5m");
  assert.match(query, /fetch user\.sessions, from:now\(\)-2h, to:now\(\)/);
  assert.match(query, /\| expand frontend\.name/);
  assert.match(query, /summarize value=count\(\), by:\{displayName=frontend\.name\}/);
});

test("does not infer a breakdown for other dimensions or modified queries", () => {
  assert.equal(buildDqlDrilldownQuery({ ...sessionMetric, dimensionConfig: { dimensions: "os.name" } }, "a", "b", "5m"), undefined);
  assert.equal(buildDqlDrilldownQuery({ ...sessionMetric, dqlQuery: sessionMetric.dqlQuery.replace("| makeTimeseries", '| filter os.name == "iOS"\n| makeTimeseries') }, "a", "b", "5m"), undefined);
  assert.equal(buildDqlDrilldownQuery({ ...sessionMetric, dqlQuery: sessionMetric.dqlQuery.replace('"mobile"', '"MOBILE"') }, "a", "b", "5m"), undefined);
});

test("validates and sorts custom drill-down results", () => {
  assert.deepEqual(parseDqlDrilldownRecords([{ displayName: "B", value: 2 }, { displayName: "A", value: "10" }]), [
    { displayName: "A", value: 10 },
    { displayName: "B", value: 2 },
  ]);
  assert.deepEqual(parseDqlDrilldownRecords([]), []);
  assert.equal(parseDqlDrilldownRecords([{ displayName: "A", value: null }]), null);
  assert.equal(parseDqlDrilldownRecords([{ value: 1 }]), null);
});

test("uses a custom drill-down query and substitutes the timeframe and interval", () => {
  const metric = {
    ...sessionMetric,
    drilldownQuery: "fetch logs\n| makeTimeseries value=count(), interval:${interval}\n| fields displayName, value",
  };
  assert.equal(
    buildDqlDrilldownQuery(metric, "now()-2h", "now()", "5m"),
    "fetch logs, from:now()-2h, to:now()\n| makeTimeseries value=count(), interval:5m\n| fields displayName, value",
  );
  assert.equal(isMobileSessionDrilldown(metric), false);
});

test("enables session pills only for the recognized automatic breakdown", () => {
  assert.equal(isMobileSessionDrilldown(sessionMetric), true);
  assert.equal(isMobileSessionDrilldown({ ...sessionMetric, dqlQuery: sessionMetric.dqlQuery.replace('"mobile"', '"web"') }), false);
  assert.equal(isMobileSessionDrilldown({ ...sessionMetric, dimensionConfig: { dimensions: "os.name" } }), false);
});

test("anchors complete hourly history to the selected end and avoids recent session delay", () => {
  const now = Date.parse("2026-03-20T12:40:00Z");
  assert.deepEqual(mobileSessionHistoryWindow("now()", now), {
    from: '"2026-03-13T10:00:00.000Z"', to: '"2026-03-20T10:00:00.000Z"', startMs: Date.parse("2026-03-13T10:00:00Z"),
  });
  assert.equal(mobileSessionHistoryWindow('"2026-03-15T08:35:00Z"', now).to, '"2026-03-15T08:00:00.000Z"');
  assert.equal(mobileSessionHistoryWindow("now()-1d", now).to, '"2026-03-19T12:00:00.000Z"');
  assert.throws(() => mobileSessionHistoryWindow("invalid", now), /timeframe end/);
});

test("escapes frontend names and uses mobile session dimensions and hourly counts", () => {
  const name = 'app"\\name\nnext';
  for (const kind of ["history", "dimension", "impact"]) {
    const query = buildMobileSessionDetailQuery(name, "now()-2h", "now()", kind);
    assert.ok(query.includes(`| filter frontend.name == ${JSON.stringify(name)}`));
    assert.match(query, /\| expand frontend\.name/);
  }
  assert.match(buildMobileSessionDetailQuery(name, "a", "b", "history"), /makeTimeseries value=count\(default:0\), interval:1h, time:start_time/);
  assert.match(buildMobileSessionDetailQuery(name, "a", "b", "dimension"), /country=geo\.country\.name, os=os\.name/);
});

test("rejects incomplete or invalid history instead of inventing data", () => {
  assert.deepEqual(parseMobileSessionHistory([{ value: [0, "4", 2] }]), [0, 4, 2]);
  assert.equal(parseMobileSessionHistory([]), null);
  assert.equal(parseMobileSessionHistory([{ value: [1, null] }]), null);
  assert.equal(parseMobileSessionHistory([{ value: [1, -1] }]), null);
  const start = Date.parse("2026-03-13T10:00:00Z");
  const record = { value: Array(168).fill(1), timeframe: { start: "2026-03-13T10:00:00Z", end: "2026-03-20T10:00:00Z" } };
  assert.equal(parseMobileSessionHistory([record], start).length, 168);
  assert.equal(parseMobileSessionHistory([{ ...record, timeframe: { ...record.timeframe, start: "2026-03-13T11:00:00Z" } }], start), null);
  assert.equal(parseMobileSessionHistory([{ ...record, value: Array(167).fill(1) }], start), null);
});

test("enables error pills only for the supported matched metric and breakdown", () => {
  assert.equal(getMobileErrorDrilldownFrontend(errorMetric), "L1168_mobile");
  assert.equal(getMobileErrorDrilldownFrontend({ ...errorMetric, drilldownQuery: errorMetric.drilldownQuery.replace("L1168_mobile", "other") }), undefined);
  assert.equal(getMobileErrorDrilldownFrontend({ ...errorMetric, dqlQuery: errorMetric.dqlQuery.replace("interval:", 'filter: error.type == "crash", interval:') }), undefined);
  const escaped = JSON.stringify('app"\\ name');
  assert.equal(getMobileErrorDrilldownFrontend({
    ...errorMetric,
    dqlQuery: errorMetric.dqlQuery.replace('"L1168_mobile"', escaped),
    drilldownQuery: errorMetric.drilldownQuery.replace('"L1168_mobile"', escaped),
  }), 'app"\\ name');
  const query = buildDqlDrilldownQuery(errorMetric, "now()-2h", "now()", "5m");
  assert.match(query, /\| fields displayName=.*value, frontend\.name, error\.type/);
  assert.deepEqual(parseDqlDrilldownRecords([{ displayName: "L1168_mobile / crash", value: 4, "frontend.name": "L1168_mobile", "error.type": "crash" }]), [
    { displayName: "L1168_mobile / crash", value: 4, frontend: "L1168_mobile", errorType: "crash" },
  ]);
  assert.deepEqual(parseDqlDrilldownRecords([{ displayName: "L1168_mobile / Unknown", value: 1, "frontend.name": "L1168_mobile", "error.type": null }]), [
    { displayName: "L1168_mobile / Unknown", value: 1, frontend: "L1168_mobile", errorType: null },
  ]);
});

test("scopes error history and event breakdowns to the selected frontend and type", () => {
  const frontend = 'app"\\x';
  const type = 'crash"\\x';
  for (const kind of ["history", "dimension", "impact"]) {
    const query = buildMobileErrorDetailQuery(frontend, type, "a", "b", kind);
    assert.ok(query.includes(`frontend.name == ${JSON.stringify(frontend)} and error.type == ${JSON.stringify(type)}`));
  }
  assert.match(buildMobileErrorDetailQuery(frontend, null, "a", "b", "history"), /isNull\(error\.type\)/);
  assert.match(buildMobileErrorDetailQuery(frontend, type, "a", "b", "impact"), /countDistinct\(dt\.rum\.session\.id\)/);
});

test("custom detail queries safely substitute row and require time controls", () => {
  const template = 'filter name == ${row} | timeseries from:${from}, to:${to}, interval:${interval}';
  const row = 'app"\\name\n';
  assert.equal(buildDqlDetailQuery(template, row, '"a"', '"b"', "15m"), `filter name == ${JSON.stringify(row)} | timeseries from:"a", to:"b", interval:15m`);
  assert.throws(() => buildDqlDetailQuery("filter name == ${row}", row, "a", "b", "1h"), /from/);
  assert.throws(() => buildDqlDetailQuery("${row} ${from} ${to} ${interval}", row, "a", "b"), /interval/);
});

test("history requires complete aligned numeric data", () => {
  const start = Date.parse("2026-03-20T10:00:00Z");
  const end = start + 2 * 3600000;
  const record = { value: [0, 3], timeframe: { start: "2026-03-20T10:00:00Z", end: "2026-03-20T12:00:00Z" } };
  assert.deepEqual(parseDqlHistory([record], start, end, 3600000), [0, 3]);
  assert.throws(() => parseDqlHistory([{ ...record, value: [1, null] }], start, end, 3600000), /missing/);
  assert.throws(() => parseDqlHistory([{ ...record, value: [1, -1] }], start, end, 3600000), /negative/);
  assert.throws(() => parseDqlHistory([record], start - 3600000, end, 3600000), /timeframe/);
  assert.throws(() => parseDqlHistory([], start, end, 3600000), /timeframe/);
  assert.equal(resolveDqlTimeframeEnd("now()-1d", end), end - 86400000);
  assert.throws(() => resolveDqlTimeframeEnd("bad", end), /timeframe end/);
});

test("history parsers accept SDK-converted timeframe dates from execute and poll", async () => {
  const start = Date.parse("2026-11-11T20:00:00Z");
  const end = start + 7 * 86400000;
  const values = Array.from({ length: 168 }, (_, i) => i);
  const client = new QueryExecutionClient({
    send: async () => ({
      status: 200,
      body: async () => ({
        state: "SUCCEEDED",
        result: {
          records: [{ value: [...values], timeframe: { start: "2026-11-11T20:00:00.000000000Z", end: "2026-11-18T20:00:00.000000000Z" } }],
          types: [],
          metadata: {},
        },
      }),
    }),
  });
  for (const response of [
    await client.queryExecute({ body: { query: "data record()" } }),
    await client.queryPoll({ requestToken: "test-token" }),
  ]) {
    const records = response.result.records;
    assert.ok(records[0].timeframe.start instanceof Date);
    assert.deepEqual(parseDqlHistory(records, start, end, 3600000), values);
    assert.deepEqual(parseMobileSessionHistory(records, start), values);
    assert.throws(() => parseDqlHistory(records, start + 3600000, end, 3600000), /timeframe/);
    assert.equal(parseMobileSessionHistory(records, start + 3600000), null);
    records[0].timeframe.start = new Date(NaN);
    assert.throws(() => parseDqlHistory(records, start, end, 3600000), /timeframe/);
    assert.equal(parseMobileSessionHistory(records, start), null);
  }
});

test("long history windows are split into contiguous bounded bucket ranges", () => {
  const bucketMs = 15 * 60000;
  const end = 90 * 86400000;
  const chunks = dqlHistoryChunks(0, end, bucketMs);
  assert.equal(chunks[0].startMs, 0);
  assert.equal(chunks[chunks.length - 1].endMs, end);
  for (const [i, chunk] of chunks.entries()) {
    assert.ok((chunk.endMs - chunk.startMs) / bucketMs <= 1400);
    if (i) assert.equal(chunk.startMs, chunks[i - 1].endMs);
  }
  assert.throws(() => dqlHistoryChunks(0, 100, 60), /Invalid/);
});

test("dimension session rates aggregate counts before dividing, with session-weighted shares", () => {
  const records = [
    { country: "US", os: "iOS", numerator: 1, denominator: 2 },
    { country: "US", os: "Android", numerator: 9, denominator: 98 },
    { country: "GB", os: "iOS", numerator: 0, denominator: 10 },
    { country: "Empty", os: "Empty", numerator: 0, denominator: 0 },
  ];
  assert.deepEqual(aggregateDqlDimensions(records, "country"), [
    { name: "US", value: 100, numerator: 10, denominator: 100, avg: 10, unit: "%" },
    { name: "GB", value: 10, numerator: 0, denominator: 10, avg: 0, unit: "%" },
  ]);
  const ios = aggregateDqlDimensions(records, "os").find(slice => slice.name === "iOS");
  assert.equal(ios.denominator, 12);
  assert.equal(ios.numerator, 1);
  assert.ok(Math.abs(ios.avg - 100 / 12) < 1e-12);
  assert.deepEqual(aggregateDqlDimensions([], "os"), []);
});

test("dimension count queries remain additive and preserve unknown labels", () => {
  assert.deepEqual(aggregateDqlDimensions([
    { country: "US", os: "iOS", value: 2 },
    { country: "US", os: "Android", value: 3 },
    { country: null, os: null, value: 1 },
  ], "country"), [{ name: "US", value: 5 }, { name: "Unknown", value: 1 }]);
});

test("dimension rates reject incomplete, mixed, invalid and impossible counts", () => {
  const valid = { country: "US", os: "iOS", numerator: 1, denominator: 10 };
  for (const invalid of [
    { ...valid, numerator: undefined },
    { ...valid, numerator: "1" },
    { ...valid, numerator: -1 },
    { ...valid, numerator: 11 },
    { ...valid, denominator: 0 },
    { ...valid, denominator: Infinity },
    { ...valid, os: [] },
    { country: "US", numerator: 1, denominator: 10 },
  ]) assert.throws(() => aggregateDqlDimensions([invalid], "country"), /Dimension query/);
  assert.throws(() => aggregateDqlDimensions([valid, { country: "US", os: "iOS", value: 2 }], "country"), /Dimension query/);
  assert.throws(() => aggregateDqlDimensions([{ ...valid, denominator: Number.MAX_VALUE }, { ...valid, denominator: Number.MAX_VALUE }], "country"), /numeric range/);
});

test("built-in mobile metrics produce fully scoped drill, history and dimension queries", () => {
  const { buildDqlHeatQuery } = require("./queries.ts");
  const row = 'app"\\name\n';
  const from = '"2026-11-17T10:00:00Z"';
  const to = '"2026-11-18T10:00:00Z"';
  for (const metric of DEFAULT_HEAT_METRICS.mobile) {
    const main = buildDqlHeatQuery(metric, from, to, "15m");
    const drill = buildDqlDrilldownQuery(metric, from, to, "15m");
    const history = buildDqlDetailQuery(metric.drilldownHistoryQuery, row, from, to, "15m");
    const dimensions = buildDqlDetailQuery(metric.drilldownDimensionQuery, row, from, to);
    for (const query of [main, drill, history, dimensions]) {
      assert.match(query, /fetch user\.sessions/);
      assert.match(query, /dt\.rum\.application\.type == "mobile"/);
      assert.ok(query.includes(`from:${from}, to:${to}`));
      assert.doesNotMatch(query, /\$\{/);
    }
    for (const query of [main, history]) {
      assert.match(query, /interval:15m, time:start_time/);
      assert.match(query, /nonempty:true/);
      assert.match(query, /value=toDouble\(value\[\]\)/);
    }
    assert.match(drill, /by:\{displayName=frontend\.name\}/);
    assert.match(drill, /value=toDouble\(value\)/);
    for (const query of [history, dimensions]) {
      assert.ok(query.includes(`frontend.name == ${JSON.stringify(row)}`));
    }
    assert.match(dimensions, /by:\{country=geo\.country\.name, os=os\.name\}/);
    if (metric.displayUnit === "pct") {
      assert.match(main, /avg\(sessionRate, default:0\)/);
      assert.match(drill, /value=avg\(sessionRate\)/);
      assert.match(dimensions, /numerator=countIf\(.+\), denominator=count\(\)/);
      assert.match(dimensions, /numerator=toDouble\(numerator\), denominator=toDouble\(denominator\)/);
    } else {
      assert.match(dimensions, /value=toDouble\(value\)/);
    }
  }
});

test("Mobile Experience rate defaults show one percent sign without scaling the rate", () => {
  const { resolvePersonaHeatMetrics } = require("./constants.ts");
  const { parseDqlHeatResult } = require("./queries.ts");
  const defaults = resolvePersonaHeatMetrics("mobile");
  const rates = defaults.filter(metric => metric.label.endsWith("Rate"));
  const legacyRates = rates.map(({ displaySuffix, ...metric }) => metric);
  for (const metrics of [defaults, resolvePersonaHeatMetrics("mobile", legacyRates)]) {
    for (const metric of metrics.filter(metric => metric.label.endsWith("Rate"))) {
      const result = parseDqlHeatResult([{ value: [0.125, 3] }], metric);
      assert.deepEqual(result.timeline, [0.125, 3]);
      assert.equal(result.fmt(3), "3%");
    }
  }
  const overridden = resolvePersonaHeatMetrics("mobile", [{ ...rates[0], displaySuffix: "" }]);
  assert.equal(parseDqlHeatResult([{ value: [1, 3] }], overridden.find(metric => metric.label === rates[0].label)).fmt(3), "3.00%");
});
