import type { PersonaDef, PersonaId, AppLink, ThresholdConfig, TimeframeTab, TimeframeInfo, HeatMetricConfig } from "./types";

export const APP_VERSION = "0.3.3";
export const REPO_URL = "https://github.com/TechShady/NavigatorIQ";
export const STATE_PREFIX = "iq";

export const NOOP_QUERY = "fetch logs | limit 0";

export const IQ_WHATS_NEW: string[] = [
  "Initial release of NavigatorIQ — persona-driven operational intelligence",
  "8 personas with role-specific assessments and recommendations",
  "Red / Yellow / Green health scoring with trend analysis vs previous period",
  "Forecast engine with 6 ML models (Prophet, ARIMA, SARIMA, and more)",
  "Context-aware app recommendations link directly to User Journey, Services Overview, and Frontend Overview",
  "Settings panel: customize app links and alert thresholds per persona",
];

export const PERSONAS: PersonaDef[] = [
  {
    id: "developer",
    label: "Developer",
    icon: "🧑‍💻",
    description: "Application performance & errors",
    tabSummary: "Service error rates, response times, slow traces, log errors. Recommendations link to Distributed Traces, Services, and Logs apps.",
  },
  {
    id: "sre",
    label: "SRE",
    icon: "🛡️",
    description: "Reliability, SLOs & incidents",
    tabSummary: "Service error rates, response time, log volume, and host health — all viewed through an SLO reliability lens.",
  },
  {
    id: "platform",
    label: "Platform Engineer",
    icon: "⚙️",
    description: "Hosts, containers & infrastructure",
    tabSummary: "Host CPU/memory health, K8s pod restarts, node readiness. Recommendations link to Infrastructure & Operations, Kubernetes, and Hosts apps.",
  },
  {
    id: "security",
    label: "Security / AppSec",
    icon: "🔒",
    description: "Vulnerabilities & attack detection",
    tabSummary: "Open vulnerabilities by severity, active attack detections. Recommendations link to Application Security, Vulnerabilities, and Attacks apps.",
  },
  {
    id: "dba",
    label: "DBA",
    icon: "🗄️",
    description: "Database performance & queries",
    tabSummary: "Database response times, connection failures, slow queries. Recommendations link to Databases, Distributed Traces, and Logs apps.",
  },
  {
    id: "network",
    label: "Network Admin",
    icon: "🌐",
    description: "Network health & connectivity",
    tabSummary: "Network errors, connectivity failures, traffic anomalies. Recommendations link to Network Monitoring, Smartscape, and Infrastructure apps.",
  },
  {
    id: "digital",
    label: "Digital Experience",
    icon: "📊",
    description: "User experience & business KPIs",
    tabSummary: "Session error rates, Core Web Vitals (LCP, CLS, INP), Apdex, Synthetic failures. Recommendations link to Digital Experience, Session Replay, and User Journey apps.",
  },
  {
    id: "devops",
    label: "DevOps / CI/CD",
    icon: "🏗️",
    description: "Deployments, pipelines & automation",
    tabSummary: "Deployment events, workflow failures, release issues. Recommendations link to Workflows, Releases, Kubernetes, and OpenPipeline apps.",
  },
];

export const DEFAULT_APP_LINKS: Record<PersonaId, AppLink[]> = {
  developer: [
    { label: "Distributed Tracing", appPath: "dynatrace.distributedtracing", docsUrl: "https://docs.dynatrace.com/docs/observe/application-observability/distributed-tracing", enabled: true },
    { label: "Services", appPath: "dynatrace.services", docsUrl: "https://docs.dynatrace.com/docs/observe/application-observability/services", enabled: true },
    { label: "Logs", appPath: "dynatrace.logs", docsUrl: "https://docs.dynatrace.com/docs/observe/logs", enabled: true },
    { label: "Notebooks", appPath: "dynatrace.notebooks", docsUrl: "https://docs.dynatrace.com/docs/observe/dashboards-and-notebooks/notebooks", enabled: true },
    { label: "Dashboards", appPath: "dynatrace.dashboards", docsUrl: "https://docs.dynatrace.com/docs/observe/dashboards-and-notebooks/dashboards-new", enabled: true },
  ],
  sre: [
    { label: "Problems", appPath: "dynatrace.davis.problems", docsUrl: "https://docs.dynatrace.com/docs/discover-dynatrace/platform/davis-ai/root-cause-analysis/davis-problems-app", enabled: true },
    { label: "SLOs", appPath: "dynatrace.slos", docsUrl: "https://docs.dynatrace.com/docs/observe/service-level-objectives", enabled: true },
    { label: "Anomaly Detection", appPath: "dynatrace.davis.anomaly.detection", docsUrl: "https://docs.dynatrace.com/docs/observe/davis-ai/anomaly-detection", enabled: true },
    { label: "Dashboards", appPath: "dynatrace.dashboards", docsUrl: "https://docs.dynatrace.com/docs/observe/dashboards-and-notebooks/dashboards-new", enabled: true },
    { label: "Workflows", appPath: "dynatrace.automations", docsUrl: "https://docs.dynatrace.com/docs/deliver/workflows", enabled: true },
  ],
  platform: [
    { label: "Infrastructure & Operations", appPath: "dynatrace.infraops", docsUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-monitoring", enabled: true },
    { label: "Hosts", appPath: "dynatrace.infraops", docsUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-monitoring/hosts", enabled: true },
    { label: "Kubernetes", appPath: "dynatrace.kubernetes", docsUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-monitoring/container-platform-monitoring/kubernetes", enabled: true },
    { label: "OpenPipeline", appPath: "dynatrace.openpipeline", docsUrl: "https://docs.dynatrace.com/docs/manage/openpipeline", enabled: true },
    { label: "Extensions", appPath: "dynatrace.extensions", docsUrl: "https://docs.dynatrace.com/docs/extend-dynatrace/extensions20", enabled: true },
  ],
  security: [
    { label: "Application Security", appPath: "dynatrace.security.analytics", docsUrl: "https://docs.dynatrace.com/docs/secure/application-security", enabled: true },
    { label: "Vulnerabilities", appPath: "dynatrace.security.vulnerabilities", docsUrl: "https://docs.dynatrace.com/docs/secure/application-security/vulnerability-analytics", enabled: true },
    { label: "Attacks", appPath: "dynatrace.security.attacks", docsUrl: "https://docs.dynatrace.com/docs/secure/application-security/attack-protection", enabled: true },
    { label: "Security Posture", appPath: "dynatrace.security.posture.management", docsUrl: "https://docs.dynatrace.com/docs/secure/security-posture-management", enabled: true },
    { label: "Notebooks", appPath: "dynatrace.notebooks", docsUrl: "https://docs.dynatrace.com/docs/observe/dashboards-and-notebooks/notebooks", enabled: true },
  ],
  dba: [
    { label: "Databases", appPath: "dynatrace.database.overview", docsUrl: "https://docs.dynatrace.com/docs/observe/applications-and-microservices/databases", enabled: true },
    { label: "Distributed Tracing", appPath: "dynatrace.distributedtracing", docsUrl: "https://docs.dynatrace.com/docs/observe/application-observability/distributed-tracing", enabled: true },
    { label: "Logs", appPath: "dynatrace.logs", docsUrl: "https://docs.dynatrace.com/docs/observe/logs", enabled: true },
    { label: "Dashboards", appPath: "dynatrace.dashboards", docsUrl: "https://docs.dynatrace.com/docs/observe/dashboards-and-notebooks/dashboards-new", enabled: true },
    { label: "Problems", appPath: "dynatrace.davis.problems", docsUrl: "https://docs.dynatrace.com/docs/discover-dynatrace/platform/davis-ai/root-cause-analysis/davis-problems-app", enabled: true },
  ],
  network: [
    { label: "Network Monitoring", appPath: "dynatrace.classic.network", docsUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-monitoring/network-monitoring", enabled: true },
    { label: "Infrastructure & Operations", appPath: "dynatrace.infraops", docsUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-monitoring", enabled: true },
    { label: "Problems", appPath: "dynatrace.davis.problems", docsUrl: "https://docs.dynatrace.com/docs/discover-dynatrace/platform/davis-ai/root-cause-analysis/davis-problems-app", enabled: true },
    { label: "Distributed Tracing", appPath: "dynatrace.distributedtracing", docsUrl: "https://docs.dynatrace.com/docs/observe/application-observability/distributed-tracing", enabled: true },
    { label: "Dashboards", appPath: "dynatrace.dashboards", docsUrl: "https://docs.dynatrace.com/docs/observe/dashboards-and-notebooks/dashboards-new", enabled: true },
  ],
  digital: [
    { label: "Digital Experience", appPath: "dynatrace.rum.overview", docsUrl: "https://docs.dynatrace.com/docs/observe/digital-experience", enabled: true },
    { label: "Session Replay", appPath: "dynatrace.session.replay", docsUrl: "https://docs.dynatrace.com/docs/observe/digital-experience/session-replay", enabled: true },
    { label: "Synthetic Monitoring", appPath: "dynatrace.synthetic", docsUrl: "https://docs.dynatrace.com/docs/observe/synthetic-monitoring", enabled: true },
    { label: "Dashboards", appPath: "dynatrace.dashboards", docsUrl: "https://docs.dynatrace.com/docs/observe/dashboards-and-notebooks/dashboards-new", enabled: true },
    { label: "Business Analytics", appPath: "dynatrace.business.analytics", docsUrl: "https://docs.dynatrace.com/docs/observe/business-analytics", enabled: true },
  ],
  devops: [
    { label: "Workflows", appPath: "dynatrace.automations", docsUrl: "https://docs.dynatrace.com/docs/deliver/workflows", enabled: true },
    { label: "Releases", appPath: "dynatrace.releases", docsUrl: "https://docs.dynatrace.com/docs/deliver/release-monitoring", enabled: true },
    { label: "OpenPipeline", appPath: "dynatrace.openpipeline", docsUrl: "https://docs.dynatrace.com/docs/manage/openpipeline", enabled: true },
    { label: "Kubernetes", appPath: "dynatrace.kubernetes", docsUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-monitoring/container-platform-monitoring/kubernetes", enabled: true },
    { label: "Notebooks", appPath: "dynatrace.notebooks", docsUrl: "https://docs.dynatrace.com/docs/observe/dashboards-and-notebooks/notebooks", enabled: true },
  ],
};

export const CUSTOM_APPS = {
  userJourney: { label: "User Journey & Experience", appPath: "my.user.journey.app" },
  servicesOverview: { label: "Services Overview", appPath: "my.services.overview.app" },
  frontendOverview: { label: "Frontend Overview", appPath: "my.frontend.overview.app" },
};

export const DEFAULT_HEAT_METRICS: Record<PersonaId, HeatMetricConfig[]> = {
  developer: [
    { label: "Error Count", metricKey: "dt.service.request.failure_count", aggregation: "sum", isTraffic: false, displayUnit: "count" },
    { label: "Response Time", metricKey: "dt.service.request.response_time", aggregation: "avg", isTraffic: false, displayUnit: "ns->ms" },
    { label: "Request Volume", metricKey: "dt.service.request.count", aggregation: "sum", isTraffic: true, displayUnit: "count" },
  ],
  sre: [
    { label: "Error Count", metricKey: "dt.service.request.failure_count", aggregation: "sum", isTraffic: false, displayUnit: "count" },
    { label: "Request Volume", metricKey: "dt.service.request.count", aggregation: "sum", isTraffic: true, displayUnit: "count" },
  ],
  platform: [
    { label: "CPU Usage", metricKey: "dt.host.cpu.usage", aggregation: "avg", isTraffic: false, displayUnit: "pct" },
    { label: "Memory Usage", metricKey: "dt.host.memory.usage", aggregation: "avg", isTraffic: false, displayUnit: "pct" },
  ],
  dba: [
    { label: "DB Response Time", metricKey: "dt.service.request.response_time", aggregation: "avg", isTraffic: false, displayUnit: "ns->ms" },
  ],
  digital: [],
  network: [
    { label: "Network Packet Errors", metricKey: "dt.process.network.packets.re_tx", aggregation: "sum", isTraffic: false, displayUnit: "count" },
  ],
  security: [
    { label: "Security Events", metricKey: "dt.security.attack.count", aggregation: "sum", isTraffic: false, displayUnit: "count" },
  ],
  devops: [
    { label: "Error Count", metricKey: "dt.service.request.failure_count", aggregation: "sum", isTraffic: false, displayUnit: "count" },
    { label: "Response Time", metricKey: "dt.service.request.response_time", aggregation: "avg", isTraffic: false, displayUnit: "ns->ms" },
  ],
};

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  errorRateRedPct: 5,
  errorRateYellowPct: 1,
  responseTimeRedMs: 2000,
  responseTimeYellowMs: 500,
  logErrorsRedCount: 100,
  logErrorsYellowCount: 20,
  problemsRed: 3,
  problemsYellow: 1,
  sloViolationsRed: 2,
  sloViolationsYellow: 1,
  cpuRedPct: 85,
  cpuYellowPct: 70,
  memRedPct: 90,
  memYellowPct: 80,
  podRestartsRed: 10,
  podRestartsYellow: 3,
  vulnCriticalRed: 1,
  vulnHighRed: 10,
  vulnHighYellow: 3,
  attacksRed: 1,
  attacksYellow: 0,
  dbRtRedMs: 1000,
  dbRtYellowMs: 300,
  networkErrorsRed: 100,
  networkErrorsYellow: 10,
  sessionErrorRateRedPct: 3,
  sessionErrorRateYellowPct: 0.5,
  lcpRedMs: 4000,
  lcpYellowMs: 2500,
  deploymentFailuresRed: 2,
  deploymentFailuresYellow: 1,
};

export const TIMEFRAME_TABS: TimeframeTab[] = ["30min", "2h", "today", "yesterday", "7d"];

export function getTimeframeInfo(tab: TimeframeTab): TimeframeInfo {
  switch (tab) {
    case "30min":
      return { tab, label: "Last 30 Min", from: "now()-30m", to: "now()", prevFrom: "now()-60m", prevTo: "now()-30m", prevLabel: "prior 30 min", interval: "1m", bucketLabel: "1-min" };
    case "2h":
      return { tab, label: "Last 2 Hours", from: "now()-2h", to: "now()", prevFrom: "now()-4h", prevTo: "now()-2h", prevLabel: "prior 2 hours", interval: "5m", bucketLabel: "5-min" };
    case "today":
      return { tab, label: "Today", from: "now()/d", to: "now()", prevFrom: "now()-1d/d", prevTo: "now()/d", prevLabel: "yesterday", interval: "30m", bucketLabel: "30-min" };
    case "yesterday":
      return { tab, label: "Yesterday", from: "now()-1d/d", to: "now()/d", prevFrom: "now()-2d/d", prevTo: "now()-1d/d", prevLabel: "day before", interval: "15m", bucketLabel: "15-min" };
    case "7d":
      return { tab, label: "Last 7 Days", from: "now()-7d", to: "now()", prevFrom: "now()-14d", prevTo: "now()-7d", prevLabel: "prior 7 days", interval: "1h", bucketLabel: "1-hour" };
  }
}

export const REFRESH_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "30s", value: 30000 },
  { label: "1m", value: 60000 },
  { label: "5m", value: 300000 },
];
