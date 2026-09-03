import type { PersonaDef, PersonaId, AppLink, ThresholdConfig, TimeframeTab, TimeframeInfo, HeatMetricConfig } from "./types";

export const APP_VERSION = "0.3.38";
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
    id: "k8s",
    label: "Kubernetes",
    icon: "☸️",
    description: "Cluster health & workloads",
    tabSummary: "Node and container CPU/memory, pod restarts, OOMKill events, CPU throttling, and workload availability. Recommendations link to the Kubernetes app.",
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
    { label: "SLOs", appPath: "dynatrace.service.level.objectives", docsUrl: "https://docs.dynatrace.com/docs/observe/service-level-objectives", enabled: true },
    { label: "Anomaly Detection", appPath: "dynatrace.davis.anomaly.detection", docsUrl: "https://docs.dynatrace.com/docs/observe/davis-ai/anomaly-detection", enabled: true },
    { label: "Dashboards", appPath: "dynatrace.dashboards", docsUrl: "https://docs.dynatrace.com/docs/observe/dashboards-and-notebooks/dashboards-new", enabled: true },
    { label: "Workflows", appPath: "dynatrace.automations", docsUrl: "https://docs.dynatrace.com/docs/deliver/workflows", enabled: true },
  ],
  platform: [
    { label: "Infrastructure & Operations", appPath: "dynatrace.infraops", docsUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-monitoring", enabled: true },
    { label: "Hosts", appPath: "dynatrace.infraops", docsUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-monitoring/hosts", enabled: true },
    { label: "Kubernetes", appPath: "dynatrace.kubernetes", docsUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-monitoring/container-platform-monitoring/kubernetes", enabled: true },
    { label: "OpenPipeline", appPath: "dynatrace.settings/settings/process-openpipeline", docsUrl: "https://docs.dynatrace.com/docs/manage/openpipeline", enabled: true },
    { label: "Extensions", appPath: "dynatrace.extensions", docsUrl: "https://docs.dynatrace.com/docs/extend-dynatrace/extensions20", enabled: true },
  ],
  k8s: [
    { label: "Kubernetes", appPath: "dynatrace.kubernetes", docsUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-monitoring/container-platform-monitoring/kubernetes", enabled: true },
    { label: "Infrastructure & Operations", appPath: "dynatrace.infraops", docsUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-monitoring", enabled: true },
    { label: "Logs", appPath: "dynatrace.logs", docsUrl: "https://docs.dynatrace.com/docs/observe/logs", enabled: true },
    { label: "Problems", appPath: "dynatrace.davis.problems", docsUrl: "https://docs.dynatrace.com/docs/discover-dynatrace/platform/davis-ai/root-cause-analysis/davis-problems-app", enabled: true },
    { label: "Dashboards", appPath: "dynatrace.dashboards", docsUrl: "https://docs.dynatrace.com/docs/observe/dashboards-and-notebooks/dashboards-new", enabled: true },
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
    { label: "Network Monitoring", appPath: "dynatrace.infraops/explorer/Network", docsUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-monitoring/network-monitoring", enabled: true },
    { label: "Infrastructure & Operations", appPath: "dynatrace.infraops", docsUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-monitoring", enabled: true },
    { label: "Problems", appPath: "dynatrace.davis.problems", docsUrl: "https://docs.dynatrace.com/docs/discover-dynatrace/platform/davis-ai/root-cause-analysis/davis-problems-app", enabled: true },
    { label: "Distributed Tracing", appPath: "dynatrace.distributedtracing", docsUrl: "https://docs.dynatrace.com/docs/observe/application-observability/distributed-tracing", enabled: true },
    { label: "Dashboards", appPath: "dynatrace.dashboards", docsUrl: "https://docs.dynatrace.com/docs/observe/dashboards-and-notebooks/dashboards-new", enabled: true },
  ],
  digital: [
    { label: "Digital Experience", appPath: "dynatrace.experience.vitals", docsUrl: "https://docs.dynatrace.com/docs/observe/digital-experience", enabled: true },
    { label: "Session Replay", appPath: "dynatrace.experience.vitals", docsUrl: "https://docs.dynatrace.com/docs/observe/digital-experience/session-replay", enabled: true },
    { label: "Synthetic Monitoring", appPath: "dynatrace.synthetic", docsUrl: "https://docs.dynatrace.com/docs/observe/synthetic-monitoring", enabled: true },
    { label: "Dashboards", appPath: "dynatrace.dashboards", docsUrl: "https://docs.dynatrace.com/docs/observe/dashboards-and-notebooks/dashboards-new", enabled: true },
    { label: "Business Analytics", appPath: "dynatrace.biz.explore", docsUrl: "https://docs.dynatrace.com/docs/observe/business-analytics", enabled: true },
  ],
  devops: [
    { label: "Workflows", appPath: "dynatrace.automations", docsUrl: "https://docs.dynatrace.com/docs/deliver/workflows", enabled: true },
    { label: "Releases", appPath: "dynatrace.site.reliability.guardian", docsUrl: "https://docs.dynatrace.com/docs/deliver/release-monitoring", enabled: true },
    { label: "OpenPipeline", appPath: "dynatrace.settings/settings/process-openpipeline", docsUrl: "https://docs.dynatrace.com/docs/manage/openpipeline", enabled: true },
    { label: "Kubernetes", appPath: "dynatrace.kubernetes", docsUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-monitoring/container-platform-monitoring/kubernetes", enabled: true },
    { label: "Notebooks", appPath: "dynatrace.notebooks", docsUrl: "https://docs.dynatrace.com/docs/observe/dashboards-and-notebooks/notebooks", enabled: true },
  ],
};

export const CUSTOM_APPS = {
  userJourney: { label: "User Journey & Experience", appPath: "my.user.journey.app" },
  servicesOverview: { label: "Services Overview", appPath: "my.services.overview.app" },
  frontendOverview: { label: "Frontend Overview", appPath: "my.frontend.overview.app" },
};

const N1_DQL_QUERY = `fetch spans, from:\${from}, to:\${to}
| filter db.system != "null"
| fieldsAdd slot = bin(start_time, \${interval})
| summarize c=count(), s=sum(aggregation.count),
            c1=countif(aggregation.count > 1), s1=sum(if(aggregation.count > 1, aggregation.count)),
            by: {slot}
| fieldsAdd value = toDouble(s1) - toDouble(c1)
| sort slot asc`;

const CHATTY_DQL_QUERY = `fetch spans, from:\${from}, to:\${to}
| filter isNotNull(dt.entity.service)
| fieldsAdd slot = bin(start_time, \${interval}), svc = entityName(dt.entity.service)
| summarize calls = count(), by: {slot, svc}
| filter calls > 100
| summarize value = count(), by: {slot}
| sort slot asc`;

const CIRCULAR_DQL_QUERY = `fetch spans, from:\${from}, to:\${to}
| filter isNotNull(dt.entity.service)
| fieldsAdd slot = bin(start_time, \${interval}), svc = entityName(dt.entity.service), tid = toString(trace.id)
| summarize appearances = count(), by: {slot, tid, svc}
| filter appearances > 1
| summarize value = countDistinct(svc), by: {slot}
| sort slot asc`;

const SLOW_DQL_QUERY = `fetch spans, from:\${from}, to:\${to}
| filter isNotNull(dt.entity.service)
| fieldsAdd slot = bin(start_time, \${interval}), svc = entityName(dt.entity.service), dur_ms = toDouble(duration) / 1000000.0
| summarize avg_dur = avg(dur_ms), p99_dur = percentile(dur_ms, 99), total_spans = count(), by: {slot, svc}
| fieldsAdd variance_ratio = p99_dur / avg_dur
| filter variance_ratio > 5 and total_spans > 10
| summarize value = count(), by: {slot}
| sort slot asc`;

const DB_QUERY_VOLUME_DQL = `fetch spans, from:\${from}, to:\${to}
| filter isNotNull(db.system)
| makeTimeseries value=count(), interval:\${interval}`;

const DB_AVG_TIME_DQL = `fetch spans, from:\${from}, to:\${to}
| filter isNotNull(db.system)
| makeTimeseries value=avg(toDouble(duration)/1000000.0), interval:\${interval}`;

const DB_P99_TIME_DQL = `fetch spans, from:\${from}, to:\${to}
| filter isNotNull(db.system)
| makeTimeseries value=percentile(toDouble(duration)/1000000.0, 99), interval:\${interval}`;

const DB_SLOW_QUERIES_DQL = `fetch spans, from:\${from}, to:\${to}
| filter isNotNull(db.system)
| filter duration > 500000000
| makeTimeseries value=count(), interval:\${interval}`;

const DB_ERRORS_DQL = `fetch spans, from:\${from}, to:\${to}
| filter isNotNull(db.system)
| filter otel.status_code == "ERROR"
| makeTimeseries value=count(), interval:\${interval}`;

export const DEFAULT_HEAT_METRICS: Record<PersonaId, HeatMetricConfig[]> = {
  developer: [
    { label: "Error Count", metricKey: "dt.service.request.failure_count", aggregation: "sum", isTraffic: false, displayUnit: "count", warningThreshold: 50, criticalThreshold: 200, exploreAppPath: "dynatrace.services" },
    { label: "Response Time", metricKey: "dt.service.request.response_time", aggregation: "avg", isTraffic: false, displayUnit: "ns->ms", warningThreshold: 500, criticalThreshold: 2000, exploreAppPath: "dynatrace.distributedtracing" },
    { label: "Request Volume", metricKey: "dt.service.request.count", aggregation: "sum", isTraffic: true, displayUnit: "count" },
    { label: "Error Rate", metricKey: "dt.service.request.failure_count", denominatorKey: "dt.service.request.count", aggregation: "sum", type: "ratio", isTraffic: false, displayUnit: "pct", warningThreshold: 5, criticalThreshold: 10, exploreAppPath: "dynatrace.services" },
    { label: "N+1 Queries", metricKey: "", aggregation: "sum", type: "dql", isTraffic: false, displayUnit: "count", dqlQuery: N1_DQL_QUERY, warningThreshold: 50, criticalThreshold: 100, thresholdBucketHours: 1, exploreAppPath: "my.pattern.problems.app", repoUrl: "https://github.com/TechShady/pattern-problem-app" },
    { label: "Chatty APIs", metricKey: "", aggregation: "sum", type: "dql", isTraffic: false, displayUnit: "count", dqlQuery: CHATTY_DQL_QUERY, warningThreshold: 5, criticalThreshold: 15, thresholdBucketHours: 1, exploreAppPath: "my.pattern.problems.app", repoUrl: "https://github.com/TechShady/pattern-problem-app" },
    { label: "Circular Deps", metricKey: "", aggregation: "sum", type: "dql", isTraffic: false, displayUnit: "count", dqlQuery: CIRCULAR_DQL_QUERY, warningThreshold: 3, criticalThreshold: 10, thresholdBucketHours: 1, exploreAppPath: "my.pattern.problems.app", repoUrl: "https://github.com/TechShady/pattern-problem-app" },
    { label: "Slow Consumers", metricKey: "", aggregation: "sum", type: "dql", isTraffic: false, displayUnit: "count", dqlQuery: SLOW_DQL_QUERY, warningThreshold: 5, criticalThreshold: 15, thresholdBucketHours: 1, exploreAppPath: "my.pattern.problems.app", repoUrl: "https://github.com/TechShady/pattern-problem-app" },
  ],
  sre: [
    { label: "Errors", metricKey: "dt.service.request.failure_count", aggregation: "sum", isTraffic: false, displayUnit: "count", warningThreshold: 50, criticalThreshold: 200, exploreAppPath: "dynatrace.services" },
    { label: "Traffic", metricKey: "dt.service.request.count", aggregation: "sum", isTraffic: true, displayUnit: "count" },
    { label: "Latency", metricKey: "dt.service.request.response_time", aggregation: "avg", isTraffic: false, displayUnit: "ns->ms", warningThreshold: 500, criticalThreshold: 2000, exploreAppPath: "dynatrace.services" },
    { label: "CPU Saturation", metricKey: "dt.host.cpu.usage", aggregation: "avg", isTraffic: false, displayUnit: "pct", warningThreshold: 70, criticalThreshold: 85, exploreAppPath: "dynatrace.infraops" },
    { label: "Memory Saturation", metricKey: "dt.host.memory.usage", aggregation: "avg", isTraffic: false, displayUnit: "pct", warningThreshold: 80, criticalThreshold: 90, exploreAppPath: "dynatrace.infraops" },
  ],
  platform: [
    { label: "CPU Usage", metricKey: "dt.host.cpu.usage", aggregation: "avg", isTraffic: false, displayUnit: "pct", warningThreshold: 70, criticalThreshold: 85, exploreAppPath: "dynatrace.infraops" },
    { label: "Memory Usage", metricKey: "dt.host.memory.usage", aggregation: "avg", isTraffic: false, displayUnit: "pct", warningThreshold: 80, criticalThreshold: 90, exploreAppPath: "dynatrace.infraops" },
    { label: "Disk Usage", metricKey: "dt.host.disk.used.percent", aggregation: "avg", type: "dql", dqlQuery: "timeseries value=avg(dt.host.disk.used.percent), interval:${interval}, from:${from}, to:${to}", isTraffic: false, displayUnit: "pct", warningThreshold: 80, criticalThreshold: 90, exploreAppPath: "dynatrace.infraops" },
    { label: "Disk Read", metricKey: "dt.host.disk.read_time", aggregation: "avg", type: "dql", dqlQuery: "timeseries value=avg(dt.host.disk.read_time), interval:${interval}, from:${from}, to:${to}", isTraffic: false, displayUnit: "ms", warningThreshold: 50, criticalThreshold: 100, exploreAppPath: "dynatrace.infraops" },
    { label: "Disk Write", metricKey: "dt.host.disk.write_time", aggregation: "avg", type: "dql", dqlQuery: "timeseries value=avg(dt.host.disk.write_time), interval:${interval}, from:${from}, to:${to}", isTraffic: false, displayUnit: "ms", warningThreshold: 50, criticalThreshold: 100, exploreAppPath: "dynatrace.infraops" },
    { label: "Network Bytes Sent", metricKey: "dt.host.net.bytes_tx", aggregation: "sum", type: "dql", dqlQuery: "timeseries value=sum(dt.host.net.bytes_tx), interval:${interval}, from:${from}, to:${to}", isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.infraops" },
    { label: "Network Bytes Rec", metricKey: "dt.host.net.bytes_rx", aggregation: "sum", type: "dql", dqlQuery: "timeseries value=sum(dt.host.net.bytes_rx), interval:${interval}, from:${from}, to:${to}", isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.infraops" },
    { label: "Process CPU", metricKey: "dt.process.cpu.usage", aggregation: "avg", type: "dql", dqlQuery: "timeseries value=avg(dt.process.cpu.usage), interval:${interval}, from:${from}, to:${to}", isTraffic: false, displayUnit: "pct", warningThreshold: 70, criticalThreshold: 85, exploreAppPath: "dynatrace.infraops" },
    { label: "Process Memory", metricKey: "dt.process.memory.usage", aggregation: "avg", type: "dql", dqlQuery: "timeseries value=avg(dt.process.memory.usage), interval:${interval}, from:${from}, to:${to}", isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.infraops" },
  ],
  dba: [
    { label: "Query Volume", metricKey: "", aggregation: "sum", type: "dql", dqlQuery: DB_QUERY_VOLUME_DQL, isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.database.overview" },
    { label: "Avg Query Time", metricKey: "", aggregation: "avg", type: "dql", dqlQuery: DB_AVG_TIME_DQL, isTraffic: false, displayUnit: "ms", warningThreshold: 200, criticalThreshold: 1000, exploreAppPath: "dynatrace.distributedtracing" },
    { label: "P99 Query Time", metricKey: "", aggregation: "avg", type: "dql", dqlQuery: DB_P99_TIME_DQL, isTraffic: false, displayUnit: "ms", warningThreshold: 1000, criticalThreshold: 5000, exploreAppPath: "dynatrace.distributedtracing" },
    { label: "Slow Queries", metricKey: "", aggregation: "sum", type: "dql", dqlQuery: DB_SLOW_QUERIES_DQL, isTraffic: false, displayUnit: "count", warningThreshold: 10, criticalThreshold: 50, exploreAppPath: "dynatrace.distributedtracing" },
    { label: "DB Errors", metricKey: "", aggregation: "sum", type: "dql", dqlQuery: DB_ERRORS_DQL, isTraffic: false, displayUnit: "count", warningThreshold: 5, criticalThreshold: 20, exploreAppPath: "dynatrace.distributedtracing" },
    { label: "N+1 Queries", metricKey: "", aggregation: "sum", type: "dql", dqlQuery: N1_DQL_QUERY, isTraffic: false, displayUnit: "count", warningThreshold: 50, criticalThreshold: 100, thresholdBucketHours: 1, exploreAppPath: "my.pattern.problems.app", repoUrl: "https://github.com/TechShady/pattern-problem-app" },
  ],
  digital: [
    { label: "LCP", metricKey: "dt.frontend.web.page.largest_contentful_paint", aggregation: "avg", isTraffic: false, displayUnit: "µs->ms", warningThreshold: 2500, criticalThreshold: 4000, exploreAppPath: "dynatrace.experience.vitals" },
    { label: "Duration", metricKey: "dt.frontend.user_action.duration", aggregation: "avg", isTraffic: false, displayUnit: "ms", warningThreshold: 3000, criticalThreshold: 5000, exploreAppPath: "dynatrace.experience.vitals" },
    { label: "TTFB", metricKey: "dt.frontend.web.navigation.time_to_first_byte", aggregation: "avg", isTraffic: false, displayUnit: "µs->ms", warningThreshold: 800, criticalThreshold: 1800, exploreAppPath: "dynatrace.experience.vitals" },
    { label: "INP", metricKey: "dt.frontend.web.page.interaction_to_next_paint", aggregation: "avg", isTraffic: false, displayUnit: "µs->ms", warningThreshold: 200, criticalThreshold: 500, exploreAppPath: "dynatrace.experience.vitals" },
    { label: "CLS", metricKey: "dt.frontend.web.page.cumulative_layout_shift", aggregation: "avg", isTraffic: false, displayUnit: "raw", warningThreshold: 0.1, criticalThreshold: 0.25, exploreAppPath: "dynatrace.experience.vitals" },
    { label: "Errors", metricKey: "dt.frontend.error.count", aggregation: "sum", isTraffic: false, displayUnit: "count", warningThreshold: 50, criticalThreshold: 200, exploreAppPath: "dynatrace.error.inspector" },
  ],
  network: [
    { label: "Bytes Sent", metricKey: "dt.process.network.bytes_tx", aggregation: "sum", type: "dql", dqlQuery: "timeseries value=sum(dt.process.network.bytes_tx), interval:${interval}, from:${from}, to:${to}", isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.infraops/explorer/Network" },
    { label: "Bytes Received", metricKey: "dt.process.network.bytes_rx", aggregation: "sum", type: "dql", dqlQuery: "timeseries value=sum(dt.process.network.bytes_rx), interval:${interval}, from:${from}, to:${to}", isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.infraops/explorer/Network" },
    { label: "Packets Sent", metricKey: "dt.process.network.packets.tx", aggregation: "sum", type: "dql", dqlQuery: "timeseries value=sum(dt.process.network.packets.tx), interval:${interval}, from:${from}, to:${to}", isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.infraops/explorer/Network" },
    { label: "Packets Received", metricKey: "dt.process.network.packets.rx", aggregation: "sum", type: "dql", dqlQuery: "timeseries value=sum(dt.process.network.packets.rx), interval:${interval}, from:${from}, to:${to}", isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.infraops/explorer/Network" },
    { label: "Retransmissions", metricKey: "dt.process.network.packets.re_tx", aggregation: "sum", type: "dql", dqlQuery: "timeseries value=sum(dt.process.network.packets.re_tx), interval:${interval}, from:${from}, to:${to}", isTraffic: false, displayUnit: "count", warningThreshold: 50, criticalThreshold: 200, exploreAppPath: "dynatrace.infraops/explorer/Network" },
  ],
  k8s: [
    { label: "Container CPU Usage", metricKey: "dt.kubernetes.container.cpu_usage", aggregation: "avg", type: "dql", dqlQuery: "timeseries value=avg(dt.kubernetes.container.cpu_usage), interval:${interval}, from:${from}, to:${to}", isTraffic: false, displayUnit: "pct", warningThreshold: 80, criticalThreshold: 95, exploreAppPath: "dynatrace.kubernetes" },
    { label: "Container CPU Throttled", metricKey: "dt.kubernetes.container.cpu_throttled", aggregation: "avg", type: "dql", dqlQuery: "timeseries value=avg(dt.kubernetes.container.cpu_throttled), interval:${interval}, from:${from}, to:${to}", isTraffic: false, displayUnit: "pct", warningThreshold: 50, criticalThreshold: 80, exploreAppPath: "dynatrace.kubernetes" },
    { label: "Container CPU Requests", metricKey: "dt.kubernetes.container.requests_cpu", aggregation: "avg", type: "dql", dqlQuery: "timeseries value=avg(dt.kubernetes.container.requests_cpu), interval:${interval}, from:${from}, to:${to}", isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.kubernetes" },
    { label: "Container CPU Limits", metricKey: "dt.kubernetes.container.limits_cpu", aggregation: "avg", type: "dql", dqlQuery: "timeseries value=avg(dt.kubernetes.container.limits_cpu), interval:${interval}, from:${from}, to:${to}", isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.kubernetes" },
    { label: "Container CPU Alloc", metricKey: "dt.kubernetes.node.cpu_allocatable", aggregation: "avg", type: "dql", dqlQuery: "timeseries value=avg(dt.kubernetes.node.cpu_allocatable), interval:${interval}, from:${from}, to:${to}", isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.kubernetes" },
    { label: "Container Memory", metricKey: "dt.kubernetes.container.memory_working_set", aggregation: "avg", type: "dql", dqlQuery: "timeseries value=avg(dt.kubernetes.container.memory_working_set), interval:${interval}, from:${from}, to:${to}", isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.kubernetes" },
    { label: "Container Memory Requests", metricKey: "dt.kubernetes.container.requests_memory", aggregation: "avg", type: "dql", dqlQuery: "timeseries value=avg(dt.kubernetes.container.requests_memory), interval:${interval}, from:${from}, to:${to}", isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.kubernetes" },
    { label: "Container Memory Limits", metricKey: "dt.kubernetes.container.limits_memory", aggregation: "avg", type: "dql", dqlQuery: "timeseries value=avg(dt.kubernetes.container.limits_memory), interval:${interval}, from:${from}, to:${to}", isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.kubernetes" },
    { label: "Container Memory Alloc", metricKey: "dt.kubernetes.node.memory_allocatable", aggregation: "avg", type: "dql", dqlQuery: "timeseries value=avg(dt.kubernetes.node.memory_allocatable), interval:${interval}, from:${from}, to:${to}", isTraffic: true, displayUnit: "count", exploreAppPath: "dynatrace.kubernetes" },
    { label: "OOMKill Events", metricKey: "dt.kubernetes.container.oom_kills", aggregation: "sum", type: "dql", dqlQuery: "timeseries value=sum(dt.kubernetes.container.oom_kills), interval:${interval}, from:${from}, to:${to}", isTraffic: false, displayUnit: "count", warningThreshold: 1, criticalThreshold: 3, exploreAppPath: "dynatrace.kubernetes" },
  ],
  security: [],
  devops: [
    { label: "Error Count", metricKey: "dt.service.request.failure_count", aggregation: "sum", isTraffic: false, displayUnit: "count", warningThreshold: 50, criticalThreshold: 200, exploreAppPath: "dynatrace.services" },
    { label: "Response Time", metricKey: "dt.service.request.response_time", aggregation: "avg", isTraffic: false, displayUnit: "ns->ms", warningThreshold: 500, criticalThreshold: 2000, exploreAppPath: "dynatrace.distributedtracing" },
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

export const TIMEFRAME_TABS: TimeframeTab[] = ["2h", "today", "yesterday", "7d"];

export function getTimeframeInfo(tab: TimeframeTab): TimeframeInfo {
  switch (tab) {
    case "2h":
      return { tab, label: "Last 2 Hours", from: "now()-2h", to: "now()", prevFrom: "now()-4h", prevTo: "now()-2h", prevLabel: "prior 2 hours", interval: "5m", bucketLabel: "5-min" };
    case "today":
      // "last 24h" instead of "since UTC midnight" — avoids now()/d which is unsupported
      // by the DQL timeseries metric command (works only with fetch, not timeseries)
      return { tab, label: "Today", from: "now()-24h", to: "now()", prevFrom: "now()-48h", prevTo: "now()-24h", prevLabel: "yesterday", interval: "10m", bucketLabel: "10-min" };
    case "yesterday":
      return { tab, label: "Yesterday", from: "now()-48h", to: "now()-24h", prevFrom: "now()-72h", prevTo: "now()-48h", prevLabel: "day before", interval: "10m", bucketLabel: "10-min" };
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
