export type PersonaId =
  | "developer"
  | "sre"
  | "platform"
  | "security"
  | "dba"
  | "network"
  | "digital"
  | "devops";

export type TimeframeTab = "30min" | "2h" | "today" | "yesterday" | "7d";

export type Severity = "red" | "yellow" | "green";

export type Trend = "up" | "down" | "stable";

export interface PersonaDef {
  id: PersonaId;
  label: string;
  icon: string;
  description: string;
  tabSummary: string;
}

export interface AppLink {
  label: string;
  appPath: string;
  docsUrl: string;
  enabled: boolean;
}

export interface ThresholdConfig {
  errorRateRedPct: number;
  errorRateYellowPct: number;
  responseTimeRedMs: number;
  responseTimeYellowMs: number;
  logErrorsRedCount: number;
  logErrorsYellowCount: number;
  problemsRed: number;
  problemsYellow: number;
  sloViolationsRed: number;
  sloViolationsYellow: number;
  cpuRedPct: number;
  cpuYellowPct: number;
  memRedPct: number;
  memYellowPct: number;
  podRestartsRed: number;
  podRestartsYellow: number;
  vulnCriticalRed: number;
  vulnHighRed: number;
  vulnHighYellow: number;
  attacksRed: number;
  attacksYellow: number;
  dbRtRedMs: number;
  dbRtYellowMs: number;
  networkErrorsRed: number;
  networkErrorsYellow: number;
  sessionErrorRateRedPct: number;
  sessionErrorRateYellowPct: number;
  lcpRedMs: number;
  lcpYellowMs: number;
  deploymentFailuresRed: number;
  deploymentFailuresYellow: number;
}

export interface PersonaSettings {
  appLinks: AppLink[];
  thresholds: Partial<ThresholdConfig>;
}

export interface GlobalSettings {
  defaultPersona: PersonaId;
  refreshIntervalMs: number;
}

export interface SavedSettings {
  personas: Partial<Record<PersonaId, PersonaSettings>>;
  global: Partial<GlobalSettings>;
}

export interface HeatBucketMetric {
  label: string;
  value: number;
  displayValue: string;
  zScore: number;
  isTraffic?: boolean;
}

export interface HeatBucketDetail {
  bucketIndex: number;
  zScore: number;
  level: "normal" | "elevated" | "warm" | "spike";
  metrics: HeatBucketMetric[];
}

export interface AssessmentItem {
  severity: Severity;
  title: string;
  detail: string;
  metricValue?: number;
  metricUnit?: string;
  previousValue?: number;
  trend?: Trend;
  trendPct?: number;
  recommendation: string;
  builtinAppPath?: string;
  builtinAppLabel?: string;
  customApp?: { label: string; appPath: string; tab?: string };
}

export interface Assessment {
  redItems: AssessmentItem[];
  yellowItems: AssessmentItem[];
  greenItems: AssessmentItem[];
  overallHealth: Severity;
  narrative: string;
  dataAvailable: boolean;
  heatScores: number[];
  bucketLabel: string;
  bucketDetails: HeatBucketDetail[];
}

// ─── Query result shapes ───────────────────────────────────────────────

export interface ServiceHealthResult {
  totalErrors: number;
  totalRequests: number;
  avgRtMs: number;
  errorRatePct: number;
  rtTimeline: number[];
  errorTimeline: number[];
  requestTimeline: number[];
}

export interface LogErrorsResult {
  totalLogErrors: number;
}

export interface HostHealthResult {
  avgCpuPct: number;
  avgMemPct: number;
  highCpuHosts: number;
  highMemHosts: number;
  totalHosts: number;
  cpuTimeline: number[];
}

export interface K8sResult {
  totalPodRestarts: number;
  totalNotReadyPods: number;
}

export interface SecurityResult {
  criticalVulns: number;
  highVulns: number;
  mediumVulns: number;
  totalAttacks: number;
  exploitedAttacks: number;
}

export interface DatabaseResult {
  avgRtMs: number;
  totalErrors: number;
  slowQueries: number;
  rtTimeline: number[];
}

export interface NetworkResult {
  totalNetErrors: number;
  connectivityEvents: number;
}

export interface DigitalExpResult {
  sessionErrorRatePct: number;
  totalSessions: number;
  totalErrors: number;
  avgLcpMs: number;
  avgTtfbMs: number;
  avgFcpMs: number;
  avgDurationMs: number;
  avgApdex: number;
  syntheticFailures: number;
  lcpTimeline: number[];
}

export interface DeploymentResult {
  totalDeployments: number;
  workflowFailures: number;
  releaseEvents: number;
}

export interface DigitalTimelapseResult {
  errorRateTimeline: number[];
  durationTimeline: number[];
  lcpTimeline: number[];
  ttfbTimeline: number[];
  eventsTimeline: number[];
}

export interface PlatformTimelineResult {
  cpuTimeline: number[];
  memTimeline: number[];
}

export interface AllQueryResults {
  serviceHealth: ServiceHealthResult | null;
  logErrors: LogErrorsResult | null;
  hostHealth: HostHealthResult | null;
  k8s: K8sResult | null;
  security: SecurityResult | null;
  database: DatabaseResult | null;
  network: NetworkResult | null;
  digitalExp: DigitalExpResult | null;
  deployments: DeploymentResult | null;
  digitalTimelapse: DigitalTimelapseResult | null;
  platformTimeline: PlatformTimelineResult | null;
}

export interface TimeframeInfo {
  tab: TimeframeTab;
  label: string;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  prevLabel: string;
  interval: string;
  bucketLabel: string;
}
