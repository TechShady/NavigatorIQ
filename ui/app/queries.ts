import type {
  ServiceHealthResult,
  LogErrorsResult,
  ProblemsResult,
  HostHealthResult,
  K8sResult,
  SecurityResult,
  DatabaseResult,
  NetworkResult,
  DigitalExpResult,
  DeploymentResult,
} from "./types";

// ─── DQL Query Builders ────────────────────────────────────────────────────

export function serviceHealthQuery(from: string, to: string): string {
  return `timeseries
  err=sum(dt.service.request.failure.count),
  total=sum(dt.service.request.count),
  rt=avg(dt.service.response.time),
  interval:auto, from:${from}, to:${to}
| summarize
  totalErrors=sum(arraySum(err)),
  totalRequests=sum(arraySum(total)),
  avgRtMs=avg(arrayAvg(rt))/1000000,
  rtTimeline=collectArray(arrayAvg(rt)),
  errTimeline=collectArray(arraySum(err))
| fieldsAdd errorRatePct=if(totalRequests>0, totalErrors/totalRequests*100, else:0)`;
}

export function logErrorsQuery(from: string, to: string): string {
  return `fetch logs, from:${from}, to:${to}
| filter log.level == "ERROR" or log.level == "SEVERE" or log.level == "CRITICAL"
| summarize totalLogErrors=count()`;
}

export function problemsQuery(from: string, to: string): string {
  return `fetch dt.davis.problems, from:${from}, to:${to}
| filter status == "OPEN"
| summarize
  total=count(),
  critical=countIf(severityLevel=="AVAILABILITY" or severityLevel=="ERROR"),
  performance=countIf(severityLevel=="PERFORMANCE" or severityLevel=="RESOURCE_CONTENTION")`;
}

export function hostHealthQuery(from: string, to: string): string {
  return `timeseries
  cpu=avg(dt.host.cpu.usage),
  mem=avg(dt.host.memory.usage),
  interval:auto, from:${from}, to:${to}, by:{dt.entity.host}
| summarize
  avgCpuPct=avg(arrayAvg(cpu)),
  avgMemPct=avg(arrayAvg(mem)),
  highCpuHosts=countIf(arrayAvg(cpu)>80),
  highMemHosts=countIf(arrayAvg(mem)>85),
  totalHosts=count(),
  cpuTimeline=collectArray(arrayAvg(cpu))`;
}

export function k8sQuery(from: string, to: string): string {
  return `timeseries
  restarts=sum(dt.kubernetes.pod.restart_count),
  notReady=avg(dt.kubernetes.pod.not_ready_count),
  interval:auto, from:${from}, to:${to}
| summarize
  totalPodRestarts=sum(arraySum(restarts)),
  totalNotReadyPods=max(arrayMax(notReady))`;
}

export function securityQuery(from: string, to: string): string {
  return `fetch events, from:${from}, to:${to}
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

export function databaseQuery(from: string, to: string): string {
  return `timeseries
  rt=avg(dt.service.response.time),
  err=sum(dt.service.request.failure.count),
  total=sum(dt.service.request.count),
  interval:auto, from:${from}, to:${to}
| summarize
  avgRtMs=avg(arrayAvg(rt))/1000000,
  totalErrors=sum(arraySum(err)),
  totalRequests=sum(arraySum(total)),
  rtTimeline=collectArray(arrayAvg(rt))
| fieldsAdd slowQueries=if(avgRtMs>500, totalRequests, else:0)`;
}

export function networkQuery(from: string, to: string): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "CUSTOM_INFO" and (event.category == "CONNECTIVITY" or matchesPhrase(event.title, "network") or matchesPhrase(event.title, "connect"))
| summarize connectivityEvents=count()`;
}

export function networkErrorsQuery(from: string, to: string): string {
  return `timeseries
  netErr=sum(dt.host.network.errors.total),
  interval:auto, from:${from}, to:${to}
| summarize totalNetErrors=sum(arraySum(netErr))`;
}

export function digitalExpQuery(from: string, to: string): string {
  return `timeseries
  err=sum(dt.rum.error.count),
  sessions=sum(dt.rum.session.count),
  lcp=avg(dt.rum.browser.largest_contentful_paint),
  apdex=avg(dt.rum.user_experience.apdex.value),
  interval:auto, from:${from}, to:${to}
| summarize
  totalErrors=sum(arraySum(err)),
  totalSessions=sum(arraySum(sessions)),
  avgLcpMs=avg(arrayAvg(lcp)),
  avgApdex=avg(arrayAvg(apdex)),
  lcpTimeline=collectArray(arrayAvg(lcp))
| fieldsAdd sessionErrorRatePct=if(totalSessions>0, totalErrors/totalSessions*100, else:0)`;
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
    rtTimeline: arr(r, "rtTimeline").map((v) => v / 1000000),
    errorTimeline: arr(r, "errTimeline"),
  };
}

export function parseLogErrors(records: DqlRecord[] | undefined): LogErrorsResult | null {
  const r = records?.[0];
  if (!r) return null;
  return { totalLogErrors: num(r, "totalLogErrors") };
}

export function parseProblems(records: DqlRecord[] | undefined): ProblemsResult | null {
  const r = records?.[0];
  if (!r) return null;
  return {
    total: num(r, "total"),
    critical: num(r, "critical"),
    performance: num(r, "performance"),
  };
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
    rtTimeline: arr(r, "rtTimeline").map((v) => v / 1000000),
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
    avgApdex: num(d, "avgApdex"),
    syntheticFailures: num(s, "syntheticFailures"),
    lcpTimeline: arr(d, "lcpTimeline"),
  };
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
