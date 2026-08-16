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
} from "./types";

// ─── DQL Query Builders ────────────────────────────────────────────────────

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
| summarize totalLogErrors=count()`;
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

// Per-bucket RUM timelapse — drives Digital Experience heat strip
export function digitalTimelapseQuery(from: string, to: string, interval = "auto"): string {
  return `fetch user.events, from:${from}, to:${to}
| filter dt.rum.user_type != "robot"
| fieldsAdd event_ts = coalesce(start_time, timestamp)
| fieldsAdd bucket_ts = bin(event_ts, ${interval})
| summarize
  totalEvents=count(),
  totalErrors=countIf(characteristics.has_error == true),
  avgDurationMs=avg(duration)/1000000.0,
  avgLcpMs=avg(web_vitals.largest_contentful_paint)/1000000.0,
  avgTtfbMs=avg(web_vitals.time_to_first_byte)/1000000.0,
  by: {bucket_ts}
| fieldsAdd errorRatePct=if(totalEvents>0, toDouble(totalErrors)/toDouble(totalEvents)*100, else:0.0)
| sort bucket_ts asc`;
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
  return { totalLogErrors: num(r, "totalLogErrors") };
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
  if (!records || records.length === 0) return null;
  return {
    errorRateTimeline: records.map((r) => num(r, "errorRatePct")),
    durationTimeline: records.map((r) => num(r, "avgDurationMs")),
    lcpTimeline: records.map((r) => num(r, "avgLcpMs")),
    ttfbTimeline: records.map((r) => num(r, "avgTtfbMs")),
    eventsTimeline: records.map((r) => num(r, "totalEvents")),
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
