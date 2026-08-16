import type {
  PersonaId,
  Severity,
  Trend,
  Assessment,
  AssessmentItem,
  AllQueryResults,
  ThresholdConfig,
  TimeframeInfo,
  ServiceHealthResult,
  HostHealthResult,
  K8sResult,
  SecurityResult,
  DigitalExpResult,
} from "./types";
import { DEFAULT_THRESHOLDS, CUSTOM_APPS } from "./constants";

// ─── Helpers ───────────────────────────────────────────────────────────────

function classify(value: number, redThreshold: number, yellowThreshold: number, higherIsBad = true): Severity {
  if (higherIsBad) {
    if (value >= redThreshold) return "red";
    if (value >= yellowThreshold) return "yellow";
  } else {
    if (value <= redThreshold) return "red";
    if (value <= yellowThreshold) return "yellow";
  }
  return "green";
}

function calcTrend(current: number, previous: number): { trend: Trend; trendPct: number } {
  if (previous === 0 && current === 0) return { trend: "stable", trendPct: 0 };
  if (previous === 0) return { trend: "up", trendPct: 100 };
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (Math.abs(pct) < 5) return { trend: "stable", trendPct: pct };
  return { trend: pct > 0 ? "up" : "down", trendPct: pct };
}

function pct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

function ms(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function trendLabel(trend: Trend, pct: number, higherIsBad = true): string {
  if (trend === "stable") return "stable";
  const dir = pct > 0 ? "up" : "down";
  const bad = higherIsBad ? dir === "up" : dir === "down";
  return `${bad ? "▲" : "▽"} ${Math.abs(pct)}% vs previous period`;
}

// ─── Persona-specific assessment builders ─────────────────────────────────

function assessDeveloper(cur: AllQueryResults, prev: AllQueryResults, t: ThresholdConfig, tf: TimeframeInfo): AssessmentItem[] {
  const items: AssessmentItem[] = [];
  const sh = cur.serviceHealth;
  const psh = prev.serviceHealth;
  const le = cur.logErrors;
  const ple = prev.logErrors;

  if (sh) {
    const sev = classify(sh.errorRatePct, t.errorRateRedPct, t.errorRateYellowPct);
    const trendData = psh ? calcTrend(sh.errorRatePct, psh.errorRatePct) : undefined;
    if (sev !== "green" || (sh.errorRatePct > 0)) {
      items.push({
        severity: sev,
        title: sev === "green" ? "Service Error Rate Normal" : `Service Error Rate ${sev === "red" ? "Critical" : "Elevated"}`,
        detail: `Error rate is ${pct(sh.errorRatePct)} across ${sh.totalRequests.toLocaleString()} requests. ${trendData ? trendLabel(trendData.trend, trendData.trendPct) : ""}.`,
        metricValue: sh.errorRatePct,
        metricUnit: "%",
        previousValue: psh?.errorRatePct,
        ...trendData,
        recommendation: sev === "red"
          ? "Immediately investigate in Services → open traces for failing requests to identify the root cause."
          : sev === "yellow"
          ? "Monitor the error trend in Services. Open Distributed Traces to find impacted operations."
          : "Error rate is within normal range. Continue monitoring.",
        builtinAppPath: "dynatrace.classic.services",
        builtinAppLabel: "Services",
        customApp: sev !== "green" ? { ...CUSTOM_APPS.servicesOverview, tab: "Errors" } : undefined,
      });
    }

    const rtSev = classify(sh.avgRtMs, t.responseTimeRedMs, t.responseTimeYellowMs);
    const rtTrend = psh ? calcTrend(sh.avgRtMs, psh.avgRtMs) : undefined;
    if (rtSev !== "green" || sh.avgRtMs > 100) {
      items.push({
        severity: rtSev,
        title: rtSev === "green" ? "Response Time Healthy" : `Response Time ${rtSev === "red" ? "Degraded" : "Slowdown Detected"}`,
        detail: `Average response time is ${ms(sh.avgRtMs)}. ${rtTrend ? trendLabel(rtTrend.trend, rtTrend.trendPct) : ""}. ${sh.totalRequests.toLocaleString()} requests analyzed.`,
        metricValue: sh.avgRtMs,
        metricUnit: "ms",
        previousValue: psh?.avgRtMs,
        ...rtTrend,
        recommendation: rtSev === "red"
          ? "Open Distributed Traces and filter for slow spans (>2s) to pinpoint bottlenecks."
          : rtSev === "yellow"
          ? "Review response time breakdown in Services. Check for slow database calls or downstream dependencies."
          : "Response times are healthy.",
        builtinAppPath: "dynatrace.classic.distributed.traces",
        builtinAppLabel: "Distributed Traces",
        customApp: rtSev !== "green" ? { ...CUSTOM_APPS.servicesOverview, tab: "Metrics" } : undefined,
      });
    }
  }

  if (le) {
    const logSev = classify(le.totalLogErrors, t.logErrorsRedCount, t.logErrorsYellowCount);
    const logTrend = ple ? calcTrend(le.totalLogErrors, ple.totalLogErrors) : undefined;
    items.push({
      severity: logSev,
      title: logSev === "green" ? "Log Errors in Range" : `${le.totalLogErrors.toLocaleString()} Log Errors Detected`,
      detail: `${le.totalLogErrors.toLocaleString()} ERROR/SEVERE log entries in ${tf.label}. ${logTrend ? trendLabel(logTrend.trend, logTrend.trendPct) : ""}`,
      metricValue: le.totalLogErrors,
      metricUnit: "errors",
      previousValue: ple?.totalLogErrors,
      ...logTrend,
      recommendation: logSev !== "green"
        ? "Open Logs and filter by log.level=ERROR to identify the source. Look for repeated stack traces."
        : "Log error volume is normal.",
      builtinAppPath: "dynatrace.logs",
      builtinAppLabel: "Logs",
    });
  }

  return items;
}

function assessSre(cur: AllQueryResults, prev: AllQueryResults, t: ThresholdConfig, _tf: TimeframeInfo): AssessmentItem[] {
  const items: AssessmentItem[] = [];
  const pr = cur.problems;
  const ppr = prev.problems;

  if (pr) {
    const sev = classify(pr.critical, t.problemsRed, t.problemsYellow);
    const totalSev = classify(pr.total, t.problemsRed * 2, t.problemsYellow * 2);
    const finalSev = sev === "red" || totalSev === "red" ? "red" : sev === "yellow" || totalSev === "yellow" ? "yellow" : "green";
    const trendData = ppr ? calcTrend(pr.total, ppr.total) : undefined;
    items.push({
      severity: finalSev,
      title: finalSev === "green" ? "No Active Problems" : `${pr.total} Active Problem${pr.total !== 1 ? "s" : ""} (${pr.critical} Critical)`,
      detail: `${pr.total} open problems: ${pr.critical} critical, ${pr.performance} performance. ${trendData ? trendLabel(trendData.trend, trendData.trendPct) : ""}`,
      metricValue: pr.total,
      metricUnit: "problems",
      previousValue: ppr?.total,
      ...trendData,
      recommendation: finalSev === "red"
        ? "Open Problems immediately and investigate critical availability/error events. Check impact scope and assign owners."
        : finalSev === "yellow"
        ? "Review open problems in Problems app. Verify SLO burn rates are within budget."
        : "Environment is problem-free. Review closed problems for patterns.",
      builtinAppPath: "dynatrace.classic.problems",
      builtinAppLabel: "Problems",
    });

    const sh = cur.serviceHealth;
    const psh = prev.serviceHealth;
    if (sh) {
      const sloProxy = classify(sh.errorRatePct, t.errorRateRedPct, t.errorRateYellowPct);
      const trendData2 = psh ? calcTrend(sh.errorRatePct, psh.errorRatePct) : undefined;
      items.push({
        severity: sloProxy,
        title: sloProxy === "green" ? "Service Health Supports SLOs" : "Service Errors May Threaten SLOs",
        detail: `Service error rate ${pct(sh.errorRatePct)} — sustained errors will burn SLO error budget. ${trendData2 ? trendLabel(trendData2.trend, trendData2.trendPct) : ""}`,
        metricValue: sh.errorRatePct,
        metricUnit: "%",
        previousValue: psh?.errorRatePct,
        ...trendData2,
        recommendation: sloProxy !== "green"
          ? "Open SLOs to check error budget burn rate. Correlate with Problems to identify the root cause."
          : "Error rates support SLO compliance. Review SLOs to verify burn rates.",
        builtinAppPath: "dynatrace.classic.slo",
        builtinAppLabel: "SLOs",
        customApp: sloProxy !== "green" ? { ...CUSTOM_APPS.servicesOverview, tab: "Errors" } : undefined,
      });
    }
  }

  return items;
}

function assessPlatform(cur: AllQueryResults, prev: AllQueryResults, t: ThresholdConfig, _tf: TimeframeInfo): AssessmentItem[] {
  const items: AssessmentItem[] = [];
  const hh = cur.hostHealth as HostHealthResult | null;
  const phh = prev.hostHealth as HostHealthResult | null;
  const k8s = cur.k8s as K8sResult | null;
  const pk8s = prev.k8s as K8sResult | null;

  if (hh) {
    const cpuSev = classify(hh.avgCpuPct, t.cpuRedPct, t.cpuYellowPct);
    const memSev = classify(hh.avgMemPct, t.memRedPct, t.memYellowPct);
    const cpuTrend = phh ? calcTrend(hh.avgCpuPct, phh.avgCpuPct) : undefined;
    items.push({
      severity: cpuSev,
      title: cpuSev === "green" ? "Host CPU Healthy" : `${hh.highCpuHosts} Host${hh.highCpuHosts !== 1 ? "s" : ""} CPU Critical`,
      detail: `Avg CPU ${pct(hh.avgCpuPct)} across ${hh.totalHosts} hosts. ${hh.highCpuHosts} above ${t.cpuRedPct}% threshold. ${cpuTrend ? trendLabel(cpuTrend.trend, cpuTrend.trendPct) : ""}`,
      metricValue: hh.avgCpuPct,
      metricUnit: "%",
      previousValue: phh?.avgCpuPct,
      ...cpuTrend,
      recommendation: cpuSev !== "green"
        ? "Open Hosts in Infrastructure & Operations, filter by CPU usage and drill into the top consumers."
        : "CPU utilization is healthy across your host fleet.",
      builtinAppPath: "dynatrace.infraops",
      builtinAppLabel: "Infrastructure & Operations",
    });

    const memTrend = phh ? calcTrend(hh.avgMemPct, phh.avgMemPct) : undefined;
    items.push({
      severity: memSev,
      title: memSev === "green" ? "Host Memory Healthy" : `${hh.highMemHosts} Host${hh.highMemHosts !== 1 ? "s" : ""} Memory Critical`,
      detail: `Avg memory ${pct(hh.avgMemPct)} across ${hh.totalHosts} hosts. ${hh.highMemHosts} above ${t.memRedPct}% threshold. ${memTrend ? trendLabel(memTrend.trend, memTrend.trendPct) : ""}`,
      metricValue: hh.avgMemPct,
      metricUnit: "%",
      previousValue: phh?.avgMemPct,
      ...memTrend,
      recommendation: memSev !== "green"
        ? "Check memory-heavy processes via Hosts app. Consider right-sizing or adding capacity."
        : "Memory usage is healthy.",
      builtinAppPath: "dynatrace.classic.hosts",
      builtinAppLabel: "Hosts",
    });
  }

  if (k8s) {
    const restartSev = classify(k8s.totalPodRestarts, t.podRestartsRed, t.podRestartsYellow);
    const restartTrend = pk8s ? calcTrend(k8s.totalPodRestarts, pk8s.totalPodRestarts) : undefined;
    items.push({
      severity: restartSev,
      title: restartSev === "green" ? "Kubernetes Pods Stable" : `${k8s.totalPodRestarts} Pod Restarts Detected`,
      detail: `${k8s.totalPodRestarts} pod restarts. ${k8s.totalNotReadyPods > 0 ? `${k8s.totalNotReadyPods} pods not ready.` : "All pods reporting ready."} ${restartTrend ? trendLabel(restartTrend.trend, restartTrend.trendPct) : ""}`,
      metricValue: k8s.totalPodRestarts,
      metricUnit: "restarts",
      previousValue: pk8s?.totalPodRestarts,
      ...restartTrend,
      recommendation: restartSev !== "green"
        ? "Open Kubernetes app, filter for CrashLoopBackOff or OOMKilled pods. Check resource limits and logs."
        : "Pod stability is healthy.",
      builtinAppPath: "dynatrace.kubernetes",
      builtinAppLabel: "Kubernetes",
    });
  }

  return items;
}

function assessSecurity(cur: AllQueryResults, prev: AllQueryResults, t: ThresholdConfig, _tf: TimeframeInfo): AssessmentItem[] {
  const items: AssessmentItem[] = [];
  const sec = cur.security as SecurityResult | null;
  const psec = prev.security as SecurityResult | null;

  if (sec) {
    const vulnSev = sec.criticalVulns >= t.vulnCriticalRed
      ? "red"
      : sec.highVulns >= t.vulnHighRed
      ? "red"
      : sec.highVulns >= t.vulnHighYellow
      ? "yellow"
      : "green";

    const vulnTrend = psec ? calcTrend(sec.criticalVulns + sec.highVulns, psec.criticalVulns + psec.highVulns) : undefined;
    items.push({
      severity: vulnSev,
      title: vulnSev === "green" ? "No Critical Vulnerabilities" : `${sec.criticalVulns} Critical, ${sec.highVulns} High Vulnerabilities Open`,
      detail: `${sec.criticalVulns} critical, ${sec.highVulns} high, ${sec.mediumVulns} medium open vulnerabilities. ${vulnTrend ? trendLabel(vulnTrend.trend, vulnTrend.trendPct) : ""}`,
      metricValue: sec.criticalVulns,
      metricUnit: "critical vulns",
      previousValue: psec?.criticalVulns,
      ...vulnTrend,
      recommendation: vulnSev === "red"
        ? "Open Vulnerabilities app immediately. Prioritize critical CVEs and apply patches or apply runtime protection."
        : vulnSev === "yellow"
        ? "Review high-severity vulnerabilities in Application Security. Check exploitability scores."
        : "No critical vulnerabilities open. Continue regular scanning.",
      builtinAppPath: "dynatrace.classic.vulnerabilities",
      builtinAppLabel: "Vulnerabilities",
    });

    const attackSev = classify(sec.totalAttacks, t.attacksRed, t.attacksYellow + 1);
    const exploitSev = sec.exploitedAttacks > 0 ? "red" : attackSev;
    const attackTrend = psec ? calcTrend(sec.totalAttacks, psec.totalAttacks) : undefined;
    if (sec.totalAttacks > 0 || exploitSev !== "green") {
      items.push({
        severity: exploitSev,
        title: sec.exploitedAttacks > 0 ? `${sec.exploitedAttacks} Exploited Attack${sec.exploitedAttacks !== 1 ? "s" : ""} — Immediate Action` : `${sec.totalAttacks} Attack${sec.totalAttacks !== 1 ? "s" : ""} Detected`,
        detail: `${sec.totalAttacks} attacks detected: ${sec.exploitedAttacks} exploited. ${attackTrend ? trendLabel(attackTrend.trend, attackTrend.trendPct) : ""}`,
        metricValue: sec.totalAttacks,
        metricUnit: "attacks",
        previousValue: psec?.totalAttacks,
        ...attackTrend,
        recommendation: sec.exploitedAttacks > 0
          ? "URGENT: Open Attacks app. Isolate affected services. Escalate to security team immediately."
          : "Review attack patterns in Attacks app. Verify blocking rules are active.",
        builtinAppPath: "dynatrace.classic.attacks",
        builtinAppLabel: "Attacks",
      });
    }
  }

  return items;
}

function assessDba(cur: AllQueryResults, prev: AllQueryResults, t: ThresholdConfig, _tf: TimeframeInfo): AssessmentItem[] {
  const items: AssessmentItem[] = [];
  const db = cur.database;
  const pdb = prev.database;
  const le = cur.logErrors;
  const ple = prev.logErrors;

  if (db) {
    const rtSev = classify(db.avgRtMs, t.dbRtRedMs, t.dbRtYellowMs);
    const rtTrend = pdb ? calcTrend(db.avgRtMs, pdb.avgRtMs) : undefined;
    items.push({
      severity: rtSev,
      title: rtSev === "green" ? "Database Response Time Healthy" : `Database Response Time ${rtSev === "red" ? "Critical" : "Elevated"}`,
      detail: `Average database response time ${ms(db.avgRtMs)}. ${db.totalErrors.toLocaleString()} database errors. ${rtTrend ? trendLabel(rtTrend.trend, rtTrend.trendPct) : ""}`,
      metricValue: db.avgRtMs,
      metricUnit: "ms",
      previousValue: pdb?.avgRtMs,
      ...rtTrend,
      recommendation: rtSev !== "green"
        ? "Open Databases app to identify slow queries. Use Distributed Traces to find the originating service calls."
        : "Database response times are within acceptable range.",
      builtinAppPath: "dynatrace.classic.databases",
      builtinAppLabel: "Databases",
    });
  }

  if (le) {
    const logSev = classify(le.totalLogErrors, t.logErrorsRedCount, t.logErrorsYellowCount);
    const logTrend = ple ? calcTrend(le.totalLogErrors, ple.totalLogErrors) : undefined;
    if (le.totalLogErrors > 0) {
      items.push({
        severity: logSev,
        title: `${le.totalLogErrors.toLocaleString()} Log Errors — Check for DB Messages`,
        detail: `${le.totalLogErrors.toLocaleString()} error-level log entries. Filter by database host or connection pool errors. ${logTrend ? trendLabel(logTrend.trend, logTrend.trendPct) : ""}`,
        metricValue: le.totalLogErrors,
        metricUnit: "errors",
        previousValue: ple?.totalLogErrors,
        ...logTrend,
        recommendation: "Open Logs and filter by service name or host name of your database instances.",
        builtinAppPath: "dynatrace.logs",
        builtinAppLabel: "Logs",
      });
    }
  }

  return items;
}

function assessNetwork(cur: AllQueryResults, prev: AllQueryResults, t: ThresholdConfig, _tf: TimeframeInfo): AssessmentItem[] {
  const items: AssessmentItem[] = [];
  const net = cur.network;
  const pnet = prev.network;

  if (net) {
    const errSev = classify(net.totalNetErrors, t.networkErrorsRed, t.networkErrorsYellow);
    const errTrend = pnet ? calcTrend(net.totalNetErrors, pnet.totalNetErrors) : undefined;
    items.push({
      severity: errSev,
      title: errSev === "green" ? "Network Errors Nominal" : `${net.totalNetErrors.toLocaleString()} Network Errors`,
      detail: `${net.totalNetErrors.toLocaleString()} network errors detected. ${net.connectivityEvents} connectivity events. ${errTrend ? trendLabel(errTrend.trend, errTrend.trendPct) : ""}`,
      metricValue: net.totalNetErrors,
      metricUnit: "errors",
      previousValue: pnet?.totalNetErrors,
      ...errTrend,
      recommendation: errSev !== "green"
        ? "Open Network Monitoring to identify affected hosts and traffic patterns. Check Smartscape for topology context."
        : "Network error rates are nominal.",
      builtinAppPath: "dynatrace.classic.network",
      builtinAppLabel: "Network Monitoring",
    });

    const connSev = classify(net.connectivityEvents, t.networkErrorsYellow, 1);
    if (net.connectivityEvents > 0) {
      items.push({
        severity: connSev,
        title: `${net.connectivityEvents} Connectivity Event${net.connectivityEvents !== 1 ? "s" : ""}`,
        detail: `${net.connectivityEvents} connectivity issues detected. Review network topology for affected segments.`,
        metricValue: net.connectivityEvents,
        metricUnit: "events",
        recommendation: "Open Smartscape to visualize affected connections and identify isolated services.",
        builtinAppPath: "dynatrace.classic.smartscape",
        builtinAppLabel: "Smartscape Topology",
      });
    }
  }

  return items;
}

function assessDigital(cur: AllQueryResults, prev: AllQueryResults, t: ThresholdConfig, _tf: TimeframeInfo): AssessmentItem[] {
  const items: AssessmentItem[] = [];
  const dx = cur.digitalExp as DigitalExpResult | null;
  const pdx = prev.digitalExp as DigitalExpResult | null;

  if (dx) {
    const errSev = classify(dx.sessionErrorRatePct, t.sessionErrorRateRedPct, t.sessionErrorRateYellowPct);
    const errTrend = pdx ? calcTrend(dx.sessionErrorRatePct, pdx.sessionErrorRatePct) : undefined;
    items.push({
      severity: errSev,
      title: errSev === "green" ? "Session Error Rate Normal" : `Session Error Rate ${pct(dx.sessionErrorRatePct)}`,
      detail: `${pct(dx.sessionErrorRatePct)} of ${dx.totalSessions.toLocaleString()} sessions had errors. ${errTrend ? trendLabel(errTrend.trend, errTrend.trendPct) : ""}`,
      metricValue: dx.sessionErrorRatePct,
      metricUnit: "%",
      previousValue: pdx?.sessionErrorRatePct,
      ...errTrend,
      recommendation: errSev !== "green"
        ? "Open Session Replay to investigate error sessions. Drill into User Journey → Errors tab for impacted funnels."
        : "Session error rate is healthy.",
      builtinAppPath: "dynatrace.classic.session.segmentation",
      builtinAppLabel: "Session Replay",
      customApp: errSev !== "green" ? { ...CUSTOM_APPS.userJourney, tab: "Errors" } : undefined,
    });

    if (dx.avgLcpMs > 0) {
      const lcpSev = classify(dx.avgLcpMs, t.lcpRedMs, t.lcpYellowMs);
      const lcpTrend = pdx ? calcTrend(dx.avgLcpMs, pdx.avgLcpMs) : undefined;
      items.push({
        severity: lcpSev,
        title: lcpSev === "green" ? "Core Web Vitals Healthy" : `LCP Degraded — ${ms(dx.avgLcpMs)}`,
        detail: `Largest Contentful Paint avg ${ms(dx.avgLcpMs)} (target: <2.5s good, <4s needs improvement). Apdex: ${dx.avgApdex.toFixed(2)}. ${lcpTrend ? trendLabel(lcpTrend.trend, lcpTrend.trendPct) : ""}`,
        metricValue: dx.avgLcpMs,
        metricUnit: "ms LCP",
        previousValue: pdx?.avgLcpMs,
        ...lcpTrend,
        recommendation: lcpSev !== "green"
          ? "Open User Journey → Web Vitals tab to see LCP by page. Check render-blocking resources and server response times."
          : "Core Web Vitals are in good range.",
        builtinAppPath: "dynatrace.classic.rum.overview",
        builtinAppLabel: "Digital Experience",
        customApp: lcpSev !== "green" ? { ...CUSTOM_APPS.userJourney, tab: "Web Vitals" } : undefined,
      });
    }

    if (dx.syntheticFailures > 0) {
      items.push({
        severity: "red",
        title: `${dx.syntheticFailures} Synthetic Monitor Failure${dx.syntheticFailures !== 1 ? "s" : ""}`,
        detail: `${dx.syntheticFailures} synthetic test${dx.syntheticFailures !== 1 ? "s" : ""} failed. This may indicate availability issues from external viewpoints.`,
        metricValue: dx.syntheticFailures,
        metricUnit: "failures",
        recommendation: "Open Synthetic Monitoring to see which tests failed and from which locations. Compare with real user data.",
        builtinAppPath: "dynatrace.classic.synthetic",
        builtinAppLabel: "Synthetic Monitoring",
      });
    }
  }

  return items;
}

function assessDevops(cur: AllQueryResults, prev: AllQueryResults, t: ThresholdConfig, _tf: TimeframeInfo): AssessmentItem[] {
  const items: AssessmentItem[] = [];
  const dep = cur.deployments;
  const pdep = prev.deployments;
  const sh = cur.serviceHealth;
  const psh = prev.serviceHealth;

  if (dep) {
    const failSev = classify(dep.workflowFailures, t.deploymentFailuresRed, t.deploymentFailuresYellow);
    const failTrend = pdep ? calcTrend(dep.workflowFailures, pdep.workflowFailures) : undefined;
    items.push({
      severity: dep.totalDeployments === 0 && dep.workflowFailures === 0 ? "green" : failSev,
      title: failSev === "green"
        ? `${dep.totalDeployments} Deployment${dep.totalDeployments !== 1 ? "s" : ""} — No Failures`
        : `${dep.workflowFailures} Workflow Failure${dep.workflowFailures !== 1 ? "s" : ""}`,
      detail: `${dep.totalDeployments} deployment events. ${dep.workflowFailures} workflow failures. ${failTrend ? trendLabel(failTrend.trend, failTrend.trendPct) : ""}`,
      metricValue: dep.workflowFailures,
      metricUnit: "failures",
      previousValue: pdep?.workflowFailures,
      ...failTrend,
      recommendation: failSev !== "green"
        ? "Open Workflows to inspect failed executions. Check triggered conditions and action logs."
        : dep.totalDeployments > 0
        ? "Recent deployments completed successfully. Open Releases to verify post-deploy metrics."
        : "No deployments in this period. This may be expected.",
      builtinAppPath: failSev !== "green" ? "dynatrace.automations" : "dynatrace.classic.releases",
      builtinAppLabel: failSev !== "green" ? "Workflows" : "Releases",
    });
  }

  if (sh) {
    const errSev = classify(sh.errorRatePct, t.errorRateRedPct, t.errorRateYellowPct);
    const errTrend = psh ? calcTrend(sh.errorRatePct, psh.errorRatePct) : undefined;
    if (errSev !== "green" && dep && dep.totalDeployments > 0) {
      items.push({
        severity: errSev,
        title: "Service Errors May Be Deployment-Related",
        detail: `${dep.totalDeployments} recent deployment${dep.totalDeployments !== 1 ? "s" : ""} coincide with ${pct(sh.errorRatePct)} service error rate. ${errTrend ? trendLabel(errTrend.trend, errTrend.trendPct) : ""}`,
        metricValue: sh.errorRatePct,
        metricUnit: "%",
        previousValue: psh?.errorRatePct,
        ...errTrend,
        recommendation: "Cross-reference deployment timestamps with error spikes in Services Overview. Consider rollback if errors persist.",
        builtinAppPath: "dynatrace.classic.releases",
        builtinAppLabel: "Releases",
        customApp: { ...CUSTOM_APPS.servicesOverview, tab: "Errors" },
      });
    }
  }

  return items;
}

// ─── Green item generators ─────────────────────────────────────────────────

function buildGreenItems(items: AssessmentItem[], cur: AllQueryResults): AssessmentItem[] {
  const greenItems: AssessmentItem[] = [];
  const allSevere = items.filter((i) => i.severity !== "green");

  const sh = cur.serviceHealth;
  if (sh && !allSevere.find((i) => i.title.includes("Error Rate") || i.title.includes("Response"))) {
    greenItems.push({
      severity: "green",
      title: "Services Healthy",
      detail: `Error rate ${pct(sh.errorRatePct)}, avg response time ${ms(sh.avgRtMs)} across ${sh.totalRequests.toLocaleString()} requests.`,
      recommendation: "No action required. Consider setting up SLOs for these metrics.",
    });
  }
  const hh = cur.hostHealth;
  if (hh && !allSevere.find((i) => i.title.includes("CPU") || i.title.includes("Memory"))) {
    greenItems.push({
      severity: "green",
      title: `${hh.totalHosts} Hosts Healthy`,
      detail: `Avg CPU ${pct(hh.avgCpuPct)}, avg memory ${pct(hh.avgMemPct)} across all hosts.`,
      recommendation: "Host resources are healthy. No action needed.",
    });
  }
  const pr = cur.problems;
  if (pr && pr.total === 0 && !allSevere.find((i) => i.title.includes("Problem"))) {
    greenItems.push({
      severity: "green",
      title: "No Active Davis Problems",
      detail: "Davis AI detected no anomalies in this period.",
      recommendation: "Environment is healthy. Review problem history for patterns.",
    });
  }

  return greenItems;
}

// ─── Narrative generator ───────────────────────────────────────────────────

function buildNarrative(
  items: AssessmentItem[],
  persona: PersonaId,
  tf: TimeframeInfo,
  cur: AllQueryResults,
  prev: AllQueryResults
): string {
  const reds = items.filter((i) => i.severity === "red");
  const yellows = items.filter((i) => i.severity === "yellow");

  if (reds.length === 0 && yellows.length === 0) {
    return `Your ${tf.label.toLowerCase()} environment looks healthy for the ${persona} persona. All monitored metrics are within acceptable thresholds. Review the app links below to explore your observability data in context.`;
  }

  const parts: string[] = [];

  if (reds.length > 0) {
    parts.push(`${reds.length} critical issue${reds.length !== 1 ? "s" : ""} require${reds.length === 1 ? "s" : ""} immediate attention:`);
    reds.slice(0, 2).forEach((r) => {
      if (r.metricValue != null && r.trendPct != null && Math.abs(r.trendPct) >= 10) {
        parts.push(`${r.title} — ${r.metricValue.toFixed(1)}${r.metricUnit ?? ""}, ${Math.abs(r.trendPct)}% ${r.trend === "up" ? "worse" : "better"} vs ${tf.prevLabel}.`);
      } else {
        parts.push(`${r.title}.`);
      }
    });
  }

  if (yellows.length > 0) {
    parts.push(`${yellows.length} area${yellows.length !== 1 ? "s" : ""} to monitor:`);
    yellows.slice(0, 2).forEach((y) => {
      parts.push(`${y.title}.`);
    });
  }

  const sh = cur.serviceHealth;
  const psh = prev.serviceHealth;
  if (sh && psh && sh.totalRequests > 0) {
    const reqChange = Math.round(((sh.totalRequests - psh.totalRequests) / Math.max(1, psh.totalRequests)) * 100);
    if (Math.abs(reqChange) >= 15) {
      parts.push(`Request volume ${reqChange > 0 ? "up" : "down"} ${Math.abs(reqChange)}% vs ${tf.prevLabel} (${sh.totalRequests.toLocaleString()} requests).`);
    }
  }

  return parts.join(" ");
}

// ─── Main entry point ──────────────────────────────────────────────────────

export function computeAssessment(
  cur: AllQueryResults,
  prev: AllQueryResults,
  persona: PersonaId,
  partialThresholds: Partial<ThresholdConfig>,
  tf: TimeframeInfo
): Assessment {
  const t: ThresholdConfig = { ...DEFAULT_THRESHOLDS, ...partialThresholds };

  const hasAnyData = Object.values(cur).some((v) => v !== null);
  if (!hasAnyData) {
    return {
      redItems: [],
      yellowItems: [],
      greenItems: [],
      overallHealth: "green",
      narrative: "Loading data… Queries are executing. Results will appear shortly.",
      dataAvailable: false,
    };
  }

  let allItems: AssessmentItem[];
  switch (persona) {
    case "developer": allItems = assessDeveloper(cur, prev, t, tf); break;
    case "sre": allItems = assessSre(cur, prev, t, tf); break;
    case "platform": allItems = assessPlatform(cur, prev, t, tf); break;
    case "security": allItems = assessSecurity(cur, prev, t, tf); break;
    case "dba": allItems = assessDba(cur, prev, t, tf); break;
    case "network": allItems = assessNetwork(cur, prev, t, tf); break;
    case "digital": allItems = assessDigital(cur, prev, t, tf); break;
    case "devops": allItems = assessDevops(cur, prev, t, tf); break;
    default: allItems = assessDeveloper(cur, prev, t, tf);
  }

  const redItems = allItems.filter((i) => i.severity === "red");
  const yellowItems = allItems.filter((i) => i.severity === "yellow");
  const existingGreenItems = allItems.filter((i) => i.severity === "green");
  const supplementalGreen = buildGreenItems(allItems, cur);
  const greenItems = [...existingGreenItems, ...supplementalGreen];

  const overallHealth: Severity = redItems.length > 0 ? "red" : yellowItems.length > 0 ? "yellow" : "green";
  const narrative = buildNarrative(allItems, persona, tf, cur, prev);

  return { redItems, yellowItems, greenItems, overallHealth, narrative, dataAvailable: true };
}
