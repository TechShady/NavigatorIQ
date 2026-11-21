import type {
  ServiceHealthResult,
  LogErrorsResult,
  HostHealthResult,
  K8sResult,
  SecurityResult,
  DatabaseResult,
  NetworkResult,
  DigitalExpResult,
  DeploymentResult,
  DigitalTimelapseResult,
  PlatformTimelineResult,
  SecurityTimelapseResult,
  HeatMetricConfig,
  MetricDisplayUnit,
} from "./types";

// ─── DQL Query Builders ────────────────────────────────────────────────────

export function buildEntityBreakdownQuery(metricKey: string, entityField: string, from: string, to: string, scale: number, dimensions?: string): string {
  const fields = dimensions?.trim() ? dimensions.split(",").map(dimension => {
    const field = dimension.trim();
    return /^entityName\((dt\.entity\.[\w.]+)\)$/.exec(field)?.[1] ?? field;
  }) : [entityField];
  if (fields.some(field => !/^[a-zA-Z_][\w]*(?:\.[\w-]+)*$/.test(field))) {
    throw new Error("Follow the Red dimensions must be metric field names (for example, dt.entity.service).");
  }
  const entity = fields.find(field => field === entityField);
  const names = fields.map(field => field.startsWith("dt.entity.")
    ? `coalesce(entityName(${field}), toString(${field}), "Unknown")`
    : `coalesce(toString(${field}), "Unknown")`);
  const ratio = metricKey === "dt.service.request.failure_rate";
  const count = ["dt.service.request.failure_count", "dt.service.request.count"].includes(metricKey);
  const aggregation = ratio
    ? "failures=sum(dt.service.request.failure_count, scalar:true, default:0), requests=sum(dt.service.request.count, scalar:true)"
    : count ? `val=sum(${metricKey}, scalar:true)` : `val=avg(${metricKey}, scalar:true)`;
  const value = ratio ? "if(requests > 0, failures * 100.0 / requests)" : scale === 1 ? "val" : `val * ${scale}`;
  const displayName = names.length === 1 ? names[0] : `concat(${names.join(', " / ", ')})`;
  return `timeseries ${aggregation}, from:${from}, to:${to}, by:{${fields.join(", ")}}
| fieldsAdd avg=${value}
| filter isNotNull(avg)
| sort avg desc
| limit 10
| fields entityId=${entity ? `toString(${entity})` : '""'}, displayName=${displayName}, avg`;
}

export function serviceHealthQuery(from: string, to: string, interval = "auto"): string {
  return `timeseries
  err=sum(dt.service.request.failure_count),
  total=sum(dt.service.request.count),
  rt=avg(dt.service.request.response_time),
  interval:${interval}, from:${from}, to:${to}
| fieldsAdd
  totalErrors=arraySum(err),
  totalRequests=arraySum(total),
  avgRtMs=arrayAvg(rt)/1000000,
  errorRatePct=if(totalRequests>0, toDouble(totalErrors)/toDouble(totalRequests)*100, else:0.0)`;
}

export function logErrorsQuery(from: string, to: string): string {
  return `fetch logs, from:${from}, to:${to}
| filter status == "ERROR" or status == "FATAL"
| makeTimeseries logTimeline = count(), interval:auto
| fieldsAdd totalLogErrors = arraySum(logTimeline)`;
}

export function hostHealthQuery(from: string, to: string): string {
  return `timeseries
  cpu=avg(dt.host.cpu.usage),
  mem=avg(dt.host.memory.usage),
  interval:auto, from:${from}, to:${to}, by:{dt.entity.host}
| fieldsAdd avgCpu=arrayAvg(cpu), avgMem=arrayAvg(mem)
| summarize
  avgCpuPct=avg(avgCpu),
  avgMemPct=avg(avgMem),
  highCpuHosts=countIf(avgCpu>80),
  highMemHosts=countIf(avgMem>85),
  totalHosts=count(),
  cpuTimeline=collectArray(avgCpu)`;
}

export function k8sQuery(from: string, to: string): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "KUBERNETES_POD_RESTART_RATE_HIGH" or event.type == "KUBERNETES_CONTAINER_OOM_KILL" or event.type == "KUBERNETES_NODE_UNSCHEDULABLE" or (isNotNull(dt.entity.cloud_application_namespace) and (matchesPhrase(event.title, "restart") or matchesPhrase(event.title, "CrashLoop")))
| summarize
  totalPodRestarts=countIf(event.type == "KUBERNETES_POD_RESTART_RATE_HIGH" or event.type == "KUBERNETES_CONTAINER_OOM_KILL" or matchesPhrase(event.title, "restart") or matchesPhrase(event.title, "CrashLoop")),
  totalNotReadyPods=countIf(event.type == "KUBERNETES_NODE_UNSCHEDULABLE")`;
}

export function securityQuery(_from: string, _to: string): string {
  return `fetch events, from:now()-90d, to:now()
| filter event.type == "VULNERABILITY_STATE_REPORT_EVENT" and vulnerabilityStatus == "OPEN"
| summarize
  criticalVulns=countIf(vulnerabilityRiskLevel=="CRITICAL"),
  highVulns=countIf(vulnerabilityRiskLevel=="HIGH"),
  mediumVulns=countIf(vulnerabilityRiskLevel=="MEDIUM"),
  totalVulns=count()`;
}

export function attacksQuery(from: string, to: string): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "ATTACK_CANDIDATE_EVENT" or event.type == "SECURITY_ATTACK_DETECTION_EVENT"
| summarize
  totalAttacks=count(),
  exploitedAttacks=countIf(attack.state=="EXPLOITING" or attack.state=="EXPLOITED")`;
}

export function databaseQuery(from: string, to: string, interval = "auto"): string {
  return `timeseries
  rt=avg(dt.service.request.response_time),
  err=sum(dt.service.request.failure_count),
  total=sum(dt.service.request.count),
  interval:${interval}, from:${from}, to:${to}
| fieldsAdd
  avgRtMs=arrayAvg(rt)/1000000,
  totalErrors=arraySum(err),
  totalRequests=arraySum(total)
| fieldsAdd slowQueries=if(avgRtMs>500, totalRequests, else:0)`;
}

export function networkQuery(from: string, to: string): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "CUSTOM_INFO" and (event.category == "CONNECTIVITY" or matchesPhrase(event.title, "network") or matchesPhrase(event.title, "connect"))
| summarize connectivityEvents=count()`;
}

export function networkErrorsQuery(from: string, to: string): string {
  return `timeseries
  retx=sum(dt.process.network.packets.re_tx),
  interval:auto, from:${from}, to:${to}
| summarize totalNetErrors=sum(arraySum(retx))`;
}

export function digitalExpQuery(from: string, to: string): string {
  return `fetch user.events, from:${from}, to:${to}
| filter dt.rum.user_type != "robot"
| summarize
  totalSessions=countDistinct(dt.rum.session.id),
  totalEvents=count(),
  totalErrors=countIf(characteristics.has_error == true),
  avgLcpMs=avg(web_vitals.largest_contentful_paint)/1000000.0,
  avgTtfbMs=avg(web_vitals.time_to_first_byte)/1000000.0,
  avgFcpMs=avg(web_vitals.first_contentful_paint)/1000000.0,
  avgDurationMs=avg(duration)/1000000.0
| fieldsAdd sessionErrorRatePct=if(totalEvents>0, toDouble(totalErrors)/toDouble(totalEvents)*100, else:0)`;
}

export function syntheticQuery(from: string, to: string): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "SYNTHETIC_NODE_OUTAGE" or event.type == "SYNTHETIC_TEST_EXECUTION_FAILED"
| summarize syntheticFailures=count()`;
}

export function deploymentQuery(from: string, to: string): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "DEPLOYMENT_EVENT" or event.type == "APPLICATION_DEPLOYMENT" or event.type == "CUSTOM_DEPLOYMENT"
| summarize totalDeployments=count()`;
}

export function deploymentTimelineQuery(from: string, to: string, interval = "auto"): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "DEPLOYMENT_EVENT" or event.type == "APPLICATION_DEPLOYMENT" or event.type == "CUSTOM_DEPLOYMENT"
| fieldsAdd _c = 1.0
| makeTimeseries { value = sum(_c) }, interval:${interval}`;
}

export function davisProblemsQuery(from: string, to: string): string {
  return `fetch dt.davis.problems, from:${from}, to:${to}
| filter event.status == "ACTIVE"
| summarize count=count(), titles=collectDistinct(event.name)`;
}

// Count problems opened per bucket — buckets by problem open time (timestamp),
// not by whether a problem is currently ACTIVE. No status filter intentional:
// we want to show when problems were created, not where they persist to.
export function davisProblemsRawQuery(from: string, to: string, interval: string): string {
  return `fetch dt.davis.problems, from:${from}, to:${to}
| makeTimeseries count=count(), interval:${interval}`;
}

export function parseDavisProblemsTimeseries(records: DqlRecord[] | undefined): number[] | null {
  const r = records?.[0];
  if (!r) return null;
  const arr = r["count"];
  if (!Array.isArray(arr)) return null;
  const counts = (arr as unknown[]).map((v) => (typeof v === "number" ? Math.round(v) : 0));
  return counts.some((c) => c > 0) ? counts : null;
}

// Per-bucket RUM timelapse — drives Digital Experience heat strip
// Query is verbatim from user-confirmed working Frontend Overview / User Journey app queries.
// Only addition: from:/to: on the fetch line. Field names, spacing, and overwrite pattern preserved.
export function digitalTimelapseQuery(from: string, to: string, _interval = "auto"): string {
  return `fetch user.events, from:${from}, to:${to}, scanLimitGBytes: 500
| filterOut dt.rum.user_type == "synthetic" OR isNull(dt.rum.user_type)
| filter characteristics.has_page_summary or characteristics.has_w3c_navigation_timings
| fieldsAdd web_vitals.largest_contentful_paint = web_vitals.largest_contentful_paint / 1000000
| makeTimeseries { timeseries = percentile(web_vitals.largest_contentful_paint, 75), value = percentile(web_vitals.largest_contentful_paint, 75, scalar: true) }`;
}

// Per-bucket host CPU/mem timelapse (no by: → truly temporal) — drives Platform heat strip
export function platformTimelineQuery(from: string, to: string, interval = "auto"): string {
  return `timeseries
  cpu=avg(dt.host.cpu.usage),
  mem=avg(dt.host.memory.usage),
  interval:${interval}, from:${from}, to:${to}`;
}

export function workflowQuery(from: string, to: string): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "WORKFLOW_EXECUTION_FAILED" or (event.type == "CUSTOM_INFO" and matchesPhrase(event.title, "workflow") and matchesPhrase(event.title, "fail"))
| summarize workflowFailures=count()`;
}

// ─── Result Parsers ────────────────────────────────────────────────────────

type DqlRecord = Record<string, unknown>;

function num(record: DqlRecord, key: string, def = 0): number {
  const v = record[key];
  if (v == null) return def;
  const n = Number(v);
  return isFinite(n) ? n : def;
}

function arr(record: DqlRecord, key: string): number[] {
  const v = record[key];
  if (!Array.isArray(v)) return [];
  return (v as unknown[]).map((x) => (x == null ? 0 : Number(x))).filter(isFinite);
}

export function parseServiceHealth(records: DqlRecord[] | undefined): ServiceHealthResult | null {
  const r = records?.[0];
  if (!r) return null;
  return {
    totalErrors: num(r, "totalErrors"),
    totalRequests: num(r, "totalRequests"),
    avgRtMs: num(r, "avgRtMs"),
    errorRatePct: num(r, "errorRatePct"),
    rtTimeline: arr(r, "rt").map((v) => v / 1000000),
    errorTimeline: arr(r, "err"),
    requestTimeline: arr(r, "total"),
  };
}

export function parseLogErrors(records: DqlRecord[] | undefined): LogErrorsResult | null {
  const r = records?.[0];
  if (!r) return null;
  return { totalLogErrors: num(r, "totalLogErrors"), logTimeline: arr(r, "logTimeline") };
}

export function parseHostHealth(records: DqlRecord[] | undefined): HostHealthResult | null {
  const r = records?.[0];
  if (!r) return null;
  return {
    avgCpuPct: num(r, "avgCpuPct"),
    avgMemPct: num(r, "avgMemPct"),
    highCpuHosts: num(r, "highCpuHosts"),
    highMemHosts: num(r, "highMemHosts"),
    totalHosts: num(r, "totalHosts"),
    cpuTimeline: arr(r, "cpuTimeline"),
  };
}

export function parseK8s(records: DqlRecord[] | undefined): K8sResult | null {
  const r = records?.[0];
  if (!r) return null;
  return {
    totalPodRestarts: num(r, "totalPodRestarts"),
    totalNotReadyPods: num(r, "totalNotReadyPods"),
  };
}

export function parseSecurity(secRecords: DqlRecord[] | undefined, attackRecords: DqlRecord[] | undefined): SecurityResult | null {
  const s = secRecords?.[0] ?? {};
  const a = attackRecords?.[0] ?? {};
  if (!secRecords?.[0] && !attackRecords?.[0]) return null;
  return {
    criticalVulns: num(s, "criticalVulns"),
    highVulns: num(s, "highVulns"),
    mediumVulns: num(s, "mediumVulns"),
    totalAttacks: num(a, "totalAttacks"),
    exploitedAttacks: num(a, "exploitedAttacks"),
  };
}

export function parseDatabase(records: DqlRecord[] | undefined): DatabaseResult | null {
  const r = records?.[0];
  if (!r) return null;
  return {
    avgRtMs: num(r, "avgRtMs"),
    totalErrors: num(r, "totalErrors"),
    slowQueries: num(r, "slowQueries"),
    rtTimeline: arr(r, "rt").map((v) => v / 1000000),
  };
}

export function parseNetwork(errRecords: DqlRecord[] | undefined, connRecords: DqlRecord[] | undefined): NetworkResult | null {
  const e = errRecords?.[0] ?? {};
  const c = connRecords?.[0] ?? {};
  if (!errRecords?.[0] && !connRecords?.[0]) return null;
  return {
    totalNetErrors: num(e, "totalNetErrors"),
    connectivityEvents: num(c, "connectivityEvents"),
  };
}

export function parseDigitalExp(dxRecords: DqlRecord[] | undefined, synthRecords: DqlRecord[] | undefined): DigitalExpResult | null {
  const d = dxRecords?.[0] ?? {};
  const s = synthRecords?.[0] ?? {};
  if (!dxRecords?.[0] && !synthRecords?.[0]) return null;
  return {
    sessionErrorRatePct: num(d, "sessionErrorRatePct"),
    totalSessions: num(d, "totalSessions"),
    totalErrors: num(d, "totalErrors"),
    avgLcpMs: num(d, "avgLcpMs"),
    avgTtfbMs: num(d, "avgTtfbMs"),
    avgFcpMs: num(d, "avgFcpMs"),
    avgDurationMs: num(d, "avgDurationMs"),
    avgApdex: num(d, "avgApdex"),
    syntheticFailures: num(s, "syntheticFailures"),
    lcpTimeline: arr(d, "lcpTimeline"),
  };
}

export function parseDigitalTimelapse(records: DqlRecord[] | undefined): DigitalTimelapseResult | null {
  const r = records?.[0];
  if (!r) return null;
  // Field name "timeseries" matches the makeTimeseries output field in the proven query pattern
  const lcpTimeline = arr(r, "timeseries");
  const eventCountTl = arr(r, "eventCount");
  if (lcpTimeline.length < 2) return null;
  return {
    errorRateTimeline: [],
    durationTimeline: [],
    lcpTimeline,
    ttfbTimeline: [],
    eventsTimeline: eventCountTl,
  };
}

export function parsePlatformTimeline(records: DqlRecord[] | undefined): PlatformTimelineResult | null {
  const r = records?.[0];
  if (!r) return null;
  const cpuTimeline = arr(r, "cpu");
  const memTimeline = arr(r, "mem");
  if (cpuTimeline.length === 0) return null;
  return { cpuTimeline, memTimeline };
}

export function parseDeploymentTimeline(records: DqlRecord[] | undefined): boolean[] | null {
  const r = records?.[0];
  if (!r) return null;
  const values = arr(r, "value");
  if (values.length < 2) return null;
  if (!values.some((v) => v > 0)) return null;
  return values.map((v) => v > 0);
}

export interface DavisProblemsResult { count: number; titles: string[] }

export function parseDavisProblems(records: DqlRecord[] | undefined): DavisProblemsResult | null {
  const r = records?.[0];
  if (!r) return null;
  const count = num(r, "count");
  if (count === 0) return null;
  const rawTitles = r["titles"];
  const titles: string[] = Array.isArray(rawTitles)
    ? (rawTitles as unknown[]).filter((t): t is string => typeof t === "string")
    : [];
  return { count, titles };
}

export function parseDeployments(deployRecords: DqlRecord[] | undefined, workflowRecords: DqlRecord[] | undefined): DeploymentResult | null {
  const d = deployRecords?.[0] ?? {};
  const w = workflowRecords?.[0] ?? {};
  if (!deployRecords?.[0] && !workflowRecords?.[0]) return null;
  return {
    totalDeployments: num(d, "totalDeployments"),
    workflowFailures: num(w, "workflowFailures"),
    releaseEvents: num(d, "totalDeployments"),
  };
}

// ─── Security timelapse (attack events per bucket) ─────────────────────────

// makeTimeseries always produces a full timeline for the time range (zero-filled when no attacks),
// so the heat strip correctly shows flat/normal when quiet and spikes during actual attack bursts
export function securityTimelapseQuery(from: string, to: string, _interval = "auto"): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "ATTACK_CANDIDATE_EVENT" or event.type == "SECURITY_ATTACK_DETECTION_EVENT"
| fieldsAdd _c = 1.0
| makeTimeseries { timeseries = sum(_c) }`;
}

export function parseSecurityTimelapse(records: DqlRecord[] | undefined): SecurityTimelapseResult | null {
  const r = records?.[0];
  if (!r) return null;
  const attackTimeline = arr(r, "timeseries");
  if (attackTimeline.length < 2) return null;
  return { attackTimeline };
}

// ─── Custom Heat Metrics Query ─────────────────────────────────────────────

export function buildCustomHeatQuery(metrics: HeatMetricConfig[], from: string, to: string, interval: string): string {
  const standard = metrics.filter((m) => m.type !== "dql" && !m.dqlQuery?.trim());
  if (standard.length === 0) return "fetch logs | limit 0";
  const fields = standard.flatMap((m, i) => {
    if (m.type === "ratio" && m.denominatorKey) {
      return [`  m${i}_n=${m.aggregation}(${m.metricKey})`, `  m${i}_d=${m.aggregation}(${m.denominatorKey})`];
    }
    return [`  m${i}=${m.aggregation}(${m.metricKey})`];
  }).join(",\n");
  return `timeseries\n${fields},\n  interval:${interval}, from:${from}, to:${to}`;
}

export function buildDqlHeatQuery(metric: HeatMetricConfig, from: string, to: string, interval: string): string {
  if (!metric.dqlQuery?.trim()) return "fetch logs | limit 0";
  // 1. Substitute any placeholders the user included
  let query = metric.dqlQuery
    .replace(/\$\{from\}/g, from)
    .replace(/\$\{to\}/g, to)
    .replace(/\$\{interval\}/g, interval);
  // 2. On every fetch line, inject from/to if not already present
  query = query.split("\n").map((line) => {
    if (!/^\s*fetch\s/.test(line)) return line;
    let result = line.trimEnd();
    if (!result.includes("from:")) result += `, from:${from}`;
    if (!result.includes("to:")) result += `, to:${to}`;
    return result;
  }).join("\n");
  return query;
}

export function isMobileSessionDrilldown(metric: HeatMetricConfig): boolean {
  const sessionCountQuery = /^\s*fetch\s+user\.sessions(?:\s*,\s*from\s*:\s*\$\{from\}\s*,\s*to\s*:\s*\$\{to\})?\s*\|\s*filter\s+dt\.rum\.application\.type\s*==\s*"mobile"\s*\|\s*makeTimeseries\s+value\s*=\s*count\(\)\s*,\s*interval\s*:\s*\$\{interval\}\s*,\s*time\s*:\s*start_time\s*$/;
  return !metric.drilldownQuery?.trim() && metric.dimensionConfig?.dimensions.trim() === "frontend.name" && sessionCountQuery.test(metric.dqlQuery ?? "");
}

export function getMobileErrorDrilldownFrontend(metric: HeatMetricConfig): string | undefined {
  const literal = String.raw`("(?:[^"\\]|\\.)*")`;
  const main = new RegExp(String.raw`^\s*timeseries\s+value\s*=\s*sum\s*\(\s*dt\.frontend\.error\.count\s*\)\s*,\s*filter\s*:\s*frontend\.name\s*==\s*${literal}\s*,\s*from\s*:\s*\$\{from\}\s*,\s*to\s*:\s*\$\{to\}\s*,\s*interval\s*:\s*\$\{interval\}\s*$`).exec(metric.dqlQuery ?? "");
  const drill = new RegExp(String.raw`^\s*timeseries\s+value\s*=\s*sum\s*\(\s*dt\.frontend\.error\.count\s*,\s*scalar\s*:\s*true\s*\)\s*,\s*by\s*:\s*\{\s*frontend\.name\s*,\s*error\.type\s*\}\s*,\s*filter\s*:\s*frontend\.name\s*==\s*${literal}\s*,\s*from\s*:\s*\$\{from\}\s*,\s*to\s*:\s*\$\{to\}\s*\|\s*fields\s+displayName\s*=\s*concat\s*\(\s*frontend\.name\s*,\s*" / "\s*,\s*coalesce\s*\(\s*error\.type\s*,\s*"Unknown"\s*\)\s*\)\s*,\s*value\s*\|\s*sort\s+value\s+desc\s*$`).exec(metric.drilldownQuery ?? "");
  if (!main || !drill) return undefined;
  try {
    const frontend: unknown = JSON.parse(main[1]);
    const drillFrontend: unknown = JSON.parse(drill[1]);
    return typeof frontend === "string" && frontend.trim() && frontend === drillFrontend ? frontend : undefined;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

export function buildDqlDrilldownQuery(metric: HeatMetricConfig, from: string, to: string, interval: string): string | undefined {
  const errorFrontend = getMobileErrorDrilldownFrontend(metric);
  if (errorFrontend) return `timeseries value=sum(dt.frontend.error.count, scalar:true),
  by:{frontend.name, error.type}, filter:frontend.name == ${JSON.stringify(errorFrontend)}, from:${from}, to:${to}
| fields displayName=concat(frontend.name, " / ", coalesce(error.type, "Unknown")), value, frontend.name, error.type
| sort value desc`;
  if (metric.drilldownQuery?.trim()) {
    return buildDqlHeatQuery({ ...metric, dqlQuery: metric.drilldownQuery }, from, to, interval);
  }

  if (!isMobileSessionDrilldown(metric)) return undefined;

  return `fetch user.sessions, from:${from}, to:${to}
| filter dt.rum.application.type == "mobile"
| expand frontend.name
| filter isNotNull(frontend.name)
| summarize value=count(), by:{displayName=frontend.name}
| sort value desc
| limit 50`;
}

export function buildMobileErrorDetailQuery(frontend: string, errorType: string | null, from: string, to: string, kind: "history" | "dimension" | "impact", interval = "1h"): string {
  const filter = `frontend.name == ${JSON.stringify(frontend)} and ${errorType === null ? "isNull(error.type)" : `error.type == ${JSON.stringify(errorType)}`}`;
  if (kind === "history") return `timeseries value=sum(dt.frontend.error.count, default:0), filter:${filter}, from:${from}, to:${to}, interval:${interval}`;
  const base = `fetch user.events, from:${from}, to:${to}
| filter ${filter}
| filter characteristics.has_error == true`;
  if (kind === "dimension") return `${base}
| summarize value=count(), by:{country=geo.country.name, os=os.name}
| sort value desc`;
  return `${base}
| summarize events=count(), sessions=countDistinct(dt.rum.session.id), users=countDistinct(dt.rum.instance.id)`;
}

export function mobileSessionHistoryWindow(to: string, nowMs = Date.now()): { from: string; to: string; startMs: number } {
  const endMs = resolveDqlTimeframeEnd(to, nowMs);
  const alignedEnd = Math.floor(Math.min(endMs, nowMs - 2 * 3600000) / 3600000) * 3600000;
  const startMs = alignedEnd - 7 * 86400000;
  return { from: `"${new Date(startMs).toISOString()}"`, to: `"${new Date(alignedEnd).toISOString()}"`, startMs };
}

export function resolveDqlTimeframeEnd(to: string, nowMs = Date.now()): number {
  const relative = /^now\(\)(?:-(\d+)(ms|s|m|h|d|w))?$/.exec(to);
  const units: Record<string, number> = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  const endMs = relative
    ? nowMs - (relative[1] ? Number(relative[1]) * units[relative[2]] : 0)
    : Date.parse(to.replace(/^"|"$/g, ""));
  if (!Number.isFinite(endMs)) throw new Error("Cannot determine the selected timeframe end for history.");
  return endMs;
}

export function buildDqlDetailQuery(template: string, row: string, from: string, to: string, interval?: string): string {
  const required = interval ? ["row", "from", "to", "interval"] : ["row", "from", "to"];
  for (const name of required) {
    if (!template.includes(`\${${name}}`)) throw new Error(`Detail DQL must include \${${name}}.`);
  }
  return template.replace(/\$\{(row|from|to|interval)\}/g, (_, key: string) => {
    if (key === "row") return JSON.stringify(row);
    if (key === "from") return from;
    if (key === "to") return to;
    if (!interval) throw new Error("The dimension query cannot use ${interval}.");
    return interval;
  });
}

function historyTimestampMs(value: unknown): number {
  // The query SDK converts nested timeframe timestamps to Date; raw DQL uses ISO strings.
  return value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : NaN;
}

export function parseDqlHistory(records: DqlRecord[], startMs: number, endMs: number, bucketMs: number): number[] {
  const record = records[0];
  if (records.length !== 1 || !Array.isArray(record?.value) || !record.timeframe || typeof record.timeframe !== "object"
    || !("start" in record.timeframe) || !("end" in record.timeframe)
    || historyTimestampMs(record.timeframe.start) !== startMs || historyTimestampMs(record.timeframe.end) !== endMs
    || record.value.length !== (endMs - startMs) / bucketMs) {
    throw new Error("History query must return one complete value array with the requested timeframe and interval.");
  }
  const values = record.value.map((v: unknown) => typeof v === "number" ? v : NaN);
  if (values.length < 2 || values.some((v: number) => !Number.isFinite(v) || v < 0))
    throw new Error("History contains missing, negative, or invalid values; forecasting requires complete non-negative values.");
  return values;
}

export interface DqlDimensionSlice {
  name: string;
  value: number;
  avg?: number;
  unit?: string;
  numerator?: number;
  denominator?: number;
}

export function aggregateDqlDimensions(records: Record<string, unknown>[], field: "country" | "os"): DqlDimensionSlice[] {
  const rate = records.some(record => "numerator" in record || "denominator" in record);
  const grouped = new Map<string, { value: number; numerator: number }>();
  const nonNegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  for (const record of records) {
    const value = rate ? record.denominator : record.value;
    const numerator = rate ? record.numerator : 0;
    if (!("country" in record) || !("os" in record)
      || (record.country != null && typeof record.country !== "string")
      || (record.os != null && typeof record.os !== "string")
      || !nonNegative(value) || !nonNegative(numerator) || (rate && numerator > value)) {
      throw new Error("Dimension query must return country and os with non-negative numeric value, or numeric numerator and denominator with 0 <= numerator <= denominator.");
    }
    const name = typeof record[field] === "string" && record[field] ? record[field] : "Unknown";
    const group = grouped.get(name) ?? { value: 0, numerator: 0 };
    group.value += value;
    group.numerator += numerator;
    if (!Number.isFinite(group.value) || !Number.isFinite(group.numerator)) throw new Error("Dimension totals exceed the supported numeric range.");
    grouped.set(name, group);
  }
  return Array.from(grouped, ([name, group]) => rate
    ? { name, value: group.value, numerator: group.numerator, denominator: group.value, avg: group.value > 0 ? 100 * (group.numerator / group.value) : 0, unit: "%" }
    : { name, value: group.value })
    .filter(slice => !rate || slice.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function dqlHistoryChunks(startMs: number, endMs: number, bucketMs: number): { startMs: number; endMs: number }[] {
  const count = (endMs - startMs) / bucketMs;
  if (!Number.isInteger(count) || count < 2) throw new Error("Invalid history window or interval.");
  const chunks = Math.ceil(count / 1400);
  return Array.from({ length: chunks }, (_, i) => ({
    startMs: startMs + Math.floor(count * i / chunks) * bucketMs,
    endMs: startMs + Math.floor(count * (i + 1) / chunks) * bucketMs,
  }));
}

export function buildMobileSessionDetailQuery(frontend: string, from: string, to: string, kind: "history" | "dimension" | "impact", interval = "1h"): string {
  const base = `fetch user.sessions, from:${from}, to:${to}
| filter dt.rum.application.type == "mobile"
| expand frontend.name
| filter frontend.name == ${JSON.stringify(frontend)}`;
  if (kind === "history") return `${base}
| makeTimeseries value=count(default:0), interval:${interval}, time:start_time, from:toTimestamp(${from}), to:toTimestamp(${to})`;
  if (kind === "dimension") return `${base}
| summarize value=count(), by:{country=geo.country.name, os=os.name}
| sort value desc`;
  return `${base}
| summarize sessions=count(), crashes=countIf(error.has_crash == true), crashCoverage=countIf(isNotNull(error.has_crash)), errors=countIf(error.count > 0), errorCoverage=countIf(isNotNull(error.count))`;
}

export function parseMobileSessionHistory(records: DqlRecord[], startMs?: number): number[] | null {
  if (records.length !== 1 || !Array.isArray(records[0].value)) return null;
  if (startMs !== undefined) {
    const timeframe = records[0].timeframe;
    if (!timeframe || typeof timeframe !== "object" || !("start" in timeframe) || !("end" in timeframe)
      || historyTimestampMs(timeframe.start) !== startMs || historyTimestampMs(timeframe.end) !== startMs + 7 * 86400000
      || records[0].value.length !== 168) return null;
  }
  const values = records[0].value.map((value: unknown) =>
    typeof value === "number" || (typeof value === "string" && value.trim() !== "") ? Number(value) : NaN);
  return values.length >= 2 && values.every((value: number) => Number.isFinite(value) && value >= 0) ? values : null;
}

export function parseDqlDrilldownRecords(records: DqlRecord[]): { displayName: string; value: number; frontend?: string; errorType?: string | null }[] | null {
  const rows = records.map((record) => {
    const rawValue = record.value;
    const value = typeof rawValue === "number" || (typeof rawValue === "string" && rawValue.trim() !== "")
      ? Number(rawValue)
      : NaN;
    if (typeof record.displayName !== "string" || !record.displayName.trim() || !Number.isFinite(value)) return null;
    const row: { displayName: string; value: number; frontend?: string; errorType?: string | null } = { displayName: record.displayName, value };
    if (typeof record["frontend.name"] === "string" && (typeof record["error.type"] === "string" || record["error.type"] === null)) {
      row.frontend = record["frontend.name"];
      row.errorType = record["error.type"];
    }
    return row;
  });
  if (rows.some((row) => row === null)) return null;
  return rows.filter((row): row is NonNullable<typeof row> => row !== null).sort((a, b) => b.value - a.value);
}

// Extract the DT metric key from a simple timeseries DQL query, e.g. "timeseries val=avg(dt.host.cpu.usage), ..."
function extractMetricKeyFromDql(dqlQuery?: string): string | undefined {
  if (!dqlQuery) return undefined;
  const m = /timeseries\s+\w+\s*=\s*\w+\s*\(\s*`?([\w.]+)`?\s*\)/i.exec(dqlQuery);
  return m ? m[1] : undefined;
}

export function parseDqlHeatResult(records: DqlRecord[] | undefined, metric: HeatMetricConfig): ParsedCustomMetric | null {
  if (!records) return null;
  const fmt = metric.displaySuffix?.trim()
    ? (v: number) => (Number.isInteger(v) ? String(v) : parseFloat(v.toFixed(2)).toString()) + metric.displaySuffix!.trim()
    : makeMetricFmt(metric.displayUnit);
  const effectiveMetricKey = metric.metricKey || extractMetricKeyFromDql(metric.dqlQuery);
  if (records.length === 0) {
    // Counter with no events in window — return zero baseline so metric still appears in heat chart.
    return { label: metric.label, timeline: [0, 0], isTraffic: metric.isTraffic, inverted: isInverted(metric), fmt, metricKey: effectiveMetricKey, exploreAppPath: metric.exploreAppPath };
  }
  let timeline: number[];
  if (records.length === 1) {
    // Single-record timeseries: prefer "value" field, fall back to first array field.
    // This handles queries like `timeseries apdex = avg(...)` where the field isn't named "value".
    const r0 = records[0];
    const arrayField = Array.isArray(r0["value"]) ? "value"
      : Object.keys(r0).find((k) => Array.isArray(r0[k]) && (r0[k] as unknown[]).length > 1);
    if (arrayField) {
      timeline = parseMetricTimeline(arr(r0, arrayField), metric.displayUnit);
    } else {
      // Scalar single-record (e.g. summarize without by:{slot}, field named "apdex" etc.).
      // Find a numeric field ("value" preferred, else first numeric) and use as constant baseline.
      const scalarField = "value" in r0
        ? "value"
        : Object.keys(r0).find((k) => { const v = r0[k]; return typeof v === "number" && isFinite(v as number); });
      if (!scalarField) return null;
      const sv = r0[scalarField];
      const n = typeof sv === "number" && isFinite(sv) ? sv : null;
      if (n === null) return null;
      timeline = [n, n];
    }
  } else {
    // Multi-row records (one per time bucket): prefer "value" field, fall back to first numeric field.
    // This handles queries like `summarize apdex = ..., by: {slot}` where the field isn't named "value".
    const sampleRecord = records[0];
    const valueField = "value" in sampleRecord
      ? "value"
      : Object.keys(sampleRecord).find((k) => { const v = sampleRecord[k]; return typeof v === "number" && isFinite(v); });
    if (!valueField) return null;
    timeline = records.map((r) => { const v = r[valueField]; const n = Number(v); return isFinite(n) ? n : 0; });
  }
  if (timeline.length < 2) return null;
  return { label: metric.label, timeline, isTraffic: metric.isTraffic, inverted: isInverted(metric), fmt, metricKey: effectiveMetricKey, exploreAppPath: metric.exploreAppPath };
}

const fmtMs = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}s`;
  if (v >= 10) return `${Math.round(v)}ms`;
  if (v > 0) return `${v.toFixed(2)}ms`;
  return "0ms";
};

export function makeMetricFmt(unit?: MetricDisplayUnit): (v: number) => string {
  switch (unit) {
    case "ms":      return fmtMs;
    case "ns->ms":
    case "µs->ms":  return fmtMs;
    case "pct":     return (v: number) => `${v.toFixed(2)}%`;
    case "cls":     return (v: number) => parseFloat(v.toFixed(4)).toString();
    default:        return (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : (!Number.isInteger(v) && Math.abs(v) < 100) ? parseFloat(v.toFixed(3)).toString() : Math.round(v).toLocaleString();
  }
}

export function parseMetricTimeline(raw: number[], unit?: MetricDisplayUnit): number[] {
  switch (unit) {
    case "ns->ms": return raw.map((v) => v / 1000000);
    case "µs->ms": return raw.map((v) => v / 1000);
    case "cls":    return raw.map((v) => v * 0.0001);
    default: return raw;  // "ms", "raw", "pct", "count" — value already in correct scale
  }
}

export interface ParsedCustomMetric { label: string; timeline: number[]; isTraffic?: boolean; inverted?: boolean; fmt: (v: number) => string; metricKey?: string; exploreAppPath?: string }

function isInverted(m: HeatMetricConfig): boolean {
  return m.warningThreshold !== undefined && m.criticalThreshold !== undefined && m.warningThreshold > m.criticalThreshold;
}

export function parseCustomHeat(records: DqlRecord[] | undefined, metrics: HeatMetricConfig[]): ParsedCustomMetric[] {
  const r = records?.[0];
  if (!r) return [];
  const standard = metrics.filter((m) => m.type !== "dql" && !m.dqlQuery?.trim());
  return standard
    .map((m, i) => {
      if (m.type === "ratio" && m.denominatorKey) {
        const numRaw = arr(r, `m${i}_n`);
        const denRaw = arr(r, `m${i}_d`);
        const timeline = numRaw.map((num, j) => {
          const den = denRaw[j] ?? 0;
          return den > 0 ? (num / den) * 100 : 0;
        });
        return { label: m.label, timeline, isTraffic: m.isTraffic, inverted: isInverted(m), fmt: makeMetricFmt("pct"), metricKey: m.metricKey, exploreAppPath: m.exploreAppPath };
      }
      return {
        label: m.label,
        timeline: parseMetricTimeline(arr(r, `m${i}`), m.displayUnit),
        isTraffic: m.isTraffic,
        inverted: isInverted(m),
        fmt: makeMetricFmt(m.displayUnit),
        metricKey: m.metricKey,
        exploreAppPath: m.exploreAppPath,
      };
    })
    .filter((pm) => pm.timeline.length > 1);
}
