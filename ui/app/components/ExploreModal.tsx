import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";
import { queryExecutionClient } from "@dynatrace-sdk/client-query";
import { ForecastModal } from "./ForecastModal";

// ─── Entity config ───────────────────────────────────────────────────────────

interface EntityConfig {
  entityField: string;
  appLabel: string;
  queryType?: "timeseries" | "userevents" | "frontend";
  rumExpr?: string;
  rumScaleDivisor?: number;
  valueMultiplier?: number;
  valueUnit?: string;
  entityUrl: (envUrl: string, entityId: string) => string;
  appUrl: (envUrl: string) => string;
}

const SORT = "healthIndicators%3Adescending";

function detectEntityConfig(metricKey: string, metricLabel: string): EntityConfig | null {
  if (metricKey.startsWith("dt.service.")) {
    return {
      entityField: "dt.entity.service",
      appLabel: "Services",
      valueMultiplier: metricKey.includes("response_time") ? 1 / 1000000 : undefined,
      valueUnit: metricKey.includes("response_time") ? "ms" : undefined,
      entityUrl: (e, id) => `${e}/ui/apps/dynatrace.services/explorer/services?perspective=performance&sort=${SORT}&detailsId=${id}&sidebarOpen=false`,
      appUrl: (e) => `${e}/ui/apps/dynatrace.services/explorer/services?perspective=performance&sort=${SORT}`,
    };
  }
  if (metricKey.startsWith("dt.rum.") || metricKey.startsWith("dt.frontend.")) {
    const lbl = metricLabel.toLowerCase();
    const isErrorRate = metricKey === "dt.rum.error.count" || (lbl.includes("error") && lbl.includes("rate"));
    const isCount = (metricKey === "dt.frontend.error.count" || metricKey === "dt.rum.error.count") && !isErrorRate;
    const isCls = metricKey.includes("cumulative_layout_shift");
    const goToErrors = isCount || isErrorRate;
    if (goToErrors || isCls || metricKey.startsWith("dt.rum.useraction.")) {
      const valueUnit = isCls || isCount ? undefined : isErrorRate ? "%" : "ms";
      return {
        entityField: "dt.smartscape.frontend",
        appLabel: "Digital Experience",
        queryType: "frontend",
        valueUnit,
        entityUrl: (e, id) => goToErrors
          ? `${e}/ui/apps/dynatrace.error.inspector/all?tf=now-2h%3Bnow`
          : `${e}/ui/apps/dynatrace.experience.vitals/performance/web/${id}`,
        appUrl: (e) => goToErrors ? `${e}/ui/apps/dynatrace.error.inspector/all?tf=now-2h%3Bnow` : `${e}/ui/apps/dynatrace.experience.vitals`,
      };
    }
    return {
      entityField: "dt.smartscape.frontend",
      appLabel: "Digital Experience",
      queryType: "frontend",
      valueUnit: "ms",
      entityUrl: (e, id) => `${e}/ui/apps/dynatrace.experience.vitals/performance/web/${id}`,
      appUrl: (e) => `${e}/ui/apps/dynatrace.experience.vitals`,
    };
  }
  if (metricKey.startsWith("dt.network.")) {
    return {
      entityField: "dt.entity.custom_device",
      appLabel: "Network",
      entityUrl: (e, id) => `${e}/ui/apps/dynatrace.infraops/explorer/Network/Network%20devices?perspective=Health&sort=${SORT}&fullPageId=${id}`,
      appUrl: (e) => `${e}/ui/apps/dynatrace.infraops/explorer/Network/Network%20devices?perspective=Health&sort=${SORT}`,
    };
  }
  if (metricKey.startsWith("dt.process.network.")) {
    return {
      entityField: "dt.entity.host",
      appLabel: "Infrastructure",
      entityUrl: (e, id) => `${e}/ui/apps/dynatrace.infraops/explorer/Compute/Hosts?perspective=Health&sort=${SORT}&fullPageId=${id}`,
      appUrl: (e) => `${e}/ui/apps/dynatrace.infraops/explorer/Network/Network%20devices?perspective=Health&sort=${SORT}`,
    };
  }
  if (metricKey.startsWith("dt.host.") || metricKey.startsWith("dt.process.")) {
    return {
      entityField: "dt.entity.host",
      appLabel: "Infrastructure",
      valueUnit: metricKey.includes("cpu") || metricKey.includes("mem") ? "%" : undefined,
      entityUrl: (e, id) => `${e}/ui/apps/dynatrace.infraops/explorer/Compute/Hosts?perspective=Health&sort=${SORT}&fullPageId=${id}`,
      appUrl: (e) => `${e}/ui/apps/dynatrace.infraops/explorer/Compute/Hosts?perspective=Health&sort=${SORT}`,
    };
  }
  if (metricKey.startsWith("dt.database_service.") || metricKey.startsWith("dt.db.")) {
    return {
      entityField: "dt.entity.service",
      appLabel: "Services",
      valueMultiplier: 1 / 1000000, valueUnit: "ms",
      entityUrl: (e, id) => `${e}/ui/apps/dynatrace.services/explorer/services?perspective=performance&sort=${SORT}&detailsId=${id}&sidebarOpen=false`,
      appUrl: (e) => `${e}/ui/apps/dynatrace.services/explorer/services?perspective=performance&sort=${SORT}`,
    };
  }
  if (metricKey.startsWith("dt.kubernetes.") || metricKey.startsWith("dt.k8s.")) {
    return {
      entityField: "dt.entity.cloud_application_namespace",
      appLabel: "Kubernetes",
      entityUrl: (e, id) => `${e}/ui/entity/${id}`,
      appUrl: (e) => `${e}/ui/apps/dynatrace.kubernetes`,
    };
  }
  return null;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

// Double the window for previous-period comparison, e.g. "now()-2h" → "now()-4h".
// Returns the original string unchanged if it doesn't match the expected pattern.
function doubleFrom(from: string): string {
  const m = from.match(/^now\(\)-(\d+)(ms|s|m|h|d|w)$/i);
  if (!m) return from;
  return `now()-${parseInt(m[1], 10) * 2}${m[2]}`;
}

// Strip session IDs (;jsessionid=...) and query params (?...) before summarize
// so they aggregate cleanly. Pre-computed via fieldsAdd to avoid complex by: expressions.
const CLEAN_SUB = `arrayElement(splitString(arrayElement(splitString(coalesce(page.name, ""), ";"), 0), "?"), 0)`;

// ─── Query builder ────────────────────────────────────────────────────────────

function buildExploreQuery(metricKey: string, metricLabel: string, cfg: EntityConfig, from: string, to: string): string {
  if (cfg.queryType === "frontend") {
    const lbl = metricLabel.toLowerCase();
    const isErrorRate = metricKey === "dt.rum.error.count" || (lbl.includes("error") && lbl.includes("rate"));
    const isCount = (metricKey === "dt.frontend.error.count" || metricKey === "dt.rum.error.count") && !isErrorRate;
    const fieldMap: Record<string, string> = {
      "dt.frontend.web.page.largest_contentful_paint":  "web_vitals.largest_contentful_paint",
      "dt.frontend.web.page.first_contentful_paint":    "web_vitals.first_contentful_paint",
      "dt.frontend.web.page.interaction_to_next_paint": "web_vitals.interaction_to_next_paint",
      "dt.frontend.web.navigation.time_to_first_byte":  "web_vitals.time_to_first_byte",
      "dt.frontend.user_action.duration":               "duration",
      "dt.frontend.web.page.cumulative_layout_shift":   "web_vitals.cumulative_layout_shift",
      "dt.rum.useraction.largest_contentful_paint":     "web_vitals.largest_contentful_paint",
      "dt.rum.useraction.time_to_first_byte":           "web_vitals.time_to_first_byte",
      "dt.rum.useraction.interaction_to_next_paint":    "web_vitals.interaction_to_next_paint",
      "dt.rum.useraction.duration":                     "duration",
    };
    const fieldExpr = fieldMap[metricKey] ?? "duration";
    const errorFields = `coalesce(error.csp_violation_count, 0) + coalesce(error.exception_count, 0) + coalesce(error.http_4xx_count, 0) + coalesce(error.http_5xx_count, 0) + coalesce(error.http_other_count, 0)`;

    const baseLines = [
      `fetch user.events, from:${from}, to:${to}, samplingRatio: 1, scanLimitGBytes: 500`,
      `| filterOut dt.rum.user_type == "synthetic" OR isNull(dt.rum.user_type)`,
      `| filter isNotNull(page.name) and isNotNull(frontend.name)`,
      `| fieldsAdd cleanSub = ${CLEAN_SUB}`,
    ];
    const tail = [
      `| sort avg desc`,
      `| limit 10`,
      `| fieldsAdd entityId=coalesce(frontendEntityId, "")`,
      `| fields entityId, displayName, sub, avg, sessions`,
    ];

    const lines: string[] = [...baseLines];
    if (isErrorRate) {
      lines.push(
        `| filter characteristics.has_page_summary or characteristics.has_w3c_navigation_timings`,
        `| fieldsAdd __e = ${errorFields}`,
        `| summarize errors=countIf(__e > 0), sessions=count(), frontendEntityId=takeAny(toString(dt.entity.browser_application)), by: {displayName=frontend.name, sub=cleanSub}`,
        `| fieldsAdd avg = if(sessions > 0, errors * 100.0 / sessions)`,
        `| filter isNotNull(avg) and avg > 0`,
      );
    } else if (isCount) {
      lines.push(
        `| filter characteristics.has_page_summary or characteristics.has_w3c_navigation_timings`,
        `| fieldsAdd __e = ${errorFields}`,
        `| summarize avg=sum(__e), sessions=count(), frontendEntityId=takeAny(toString(dt.entity.browser_application)), by: {displayName=frontend.name, sub=cleanSub}`,
        `| filter isNotNull(avg) and avg > 0`,
      );
    } else {
      const isCls = fieldExpr === "web_vitals.cumulative_layout_shift";
      if (isCls) {
        lines.push(
          `| filter isNotNull(${fieldExpr})`,
          `| summarize avg=percentile(${fieldExpr}, 75), sessions=count(), frontendEntityId=takeAny(toString(dt.entity.browser_application)), by: {displayName=frontend.name, sub=cleanSub}`,
          `| filter isNotNull(avg) and avg > 0`,
        );
      } else {
        // LCP, TTFB, INP, FCP, Duration
        const isDurationField = fieldExpr === "duration";
        // toLong() returns nanoseconds for web_vitals (÷1000000 = ms);
        // duration field has a 10× larger internal scale (÷10000000 = ms).
        const divisor = isDurationField ? 10000000 : 1000000;
        return [
          `fetch user.events, from:${from}, to:${to}, samplingRatio: 1, scanLimitGBytes: 500`,
          `| filterOut dt.rum.user_type == "synthetic" OR isNull(dt.rum.user_type)`,
          `| filter isNotNull(frontend.name) and isNotNull(${fieldExpr})`,
          ...(isDurationField ? [`| filter isNotNull(web_vitals.largest_contentful_paint) and isFalseOrNull(characteristics.has_page_summary)`] : []),
          `| fieldsAdd cleanSub = ${CLEAN_SUB}`,
          `| summarize avg=toLong(percentile(${fieldExpr}, 75)), sessions=count(), frontendEntityId=takeAny(toString(dt.smartscape.frontend)), by: {displayName=frontend.name, sub=cleanSub}`,
          `| fieldsAdd avg = avg / ${divisor}`,
          `| filter isNotNull(avg) and avg > 0`,
          `| sort avg desc`,
          `| limit 10`,
          `| fieldsAdd entityId=coalesce(frontendEntityId, "")`,
          `| fields entityId, displayName, sub, avg, sessions`,
        ].join("\n");
      }
    }
    lines.push(...tail);
    return lines.join("\n");
  }

  if (cfg.queryType === "userevents") {
    const lines = [
      `fetch user.events, from:${from}, to:${to}`,
      `| filterOut dt.rum.user_type == "synthetic"`,
      `| filter characteristics.has_page_summary or characteristics.has_w3c_navigation_timings`,
      `| summarize avgValue=${cfg.rumExpr ?? "percentile(duration, 75)"},`,
      `    by:{entityId=coalesce(toString(dt.entity.browser_application), ""),`,
      `        displayName=coalesce(app.name, toString(dt.entity.browser_application), "All Applications")}`,
    ];
    if (cfg.rumScaleDivisor) lines.push(`| fieldsAdd avgValue = avgValue / ${cfg.rumScaleDivisor}`);
    lines.push(`| filter isNotNull(avgValue) and avgValue > 0`, `| sort avgValue desc`, `| limit 10`);
    return lines.join("\n");
  }

  const scale = cfg.valueMultiplier ?? 1;
  const scaleExpr = scale !== 1 ? `arrayAvg(val)*${scale}` : `arrayAvg(val)`;
  return (
    `timeseries val=avg(${metricKey}), from:${from}, to:${to}, by:{${cfg.entityField}}\n` +
    `| fieldsAdd entityId=toString(${cfg.entityField}), avg=${scaleExpr}, displayName=coalesce(entityName(${cfg.entityField}), toString(${cfg.entityField}))\n` +
    `| sort avg desc\n` +
    `| limit 10\n` +
    `| fields entityId, displayName, avg`
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatVal(v: unknown, unit?: string): string {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  if (unit === "ms") return `${n >= 1000 ? (n / 1000).toFixed(1) + "s" : n.toFixed(0) + "ms"}`;
  if (unit === "%") return `${n.toFixed(1)}%`;
  const suf = unit ? ` ${unit}` : "";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M${suf}`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K${suf}`;
  if (n > 0 && n < 1) return `${n.toFixed(3)}${suf}`;
  return `${n.toFixed(1)}${suf}`;
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

function openEntity(envUrl: string, entityId: string, cfg: EntityConfig, displayName?: string, appEntityId?: string, pageName?: string) {
  const isErrors = cfg.appUrl(envUrl).includes("error.inspector");
  let url: string;
  if (isErrors) {
    url = cfg.appUrl(envUrl);
    if (cfg.queryType === "frontend" && displayName) {
      url = `${url}#filtering=Frontend+%3D+%22${displayName.replace(/[_ ]/g, "+")}%22+`;
    }
  } else if (entityId) {
    const baseUrl = cfg.entityUrl(envUrl, entityId);
    if (pageName && cfg.queryType === "frontend") {
      const encoded = encodeURIComponent(btoa(pageName));
      url = `${baseUrl}/pages/${encoded}?setQuickFilter=%7B%22frontendType%22%3A%7B%22selected%22%3A%5B%22web%22%5D%7D%7D`;
    } else {
      url = baseUrl;
    }
  } else {
    url = cfg.appUrl(envUrl);
  }
  try { window.open(url, "_blank"); }
  catch { window.open(url.replace(envUrl, ""), "_blank"); }
}

// ─── Higher-is-better helper ─────────────────────────────────────────────────

function isHigherBetter(metricKey: string, metricLabel: string): boolean {
  const lbl = metricLabel.toLowerCase();
  if (/conversion/i.test(lbl) || /apdex/i.test(lbl)) return true;
  return false;
}

// ─── Entity sparkline query ───────────────────────────────────────────────────

function buildEntitySparklineQuery(
  metricKey: string,
  metricLabel: string,
  cfg: EntityConfig,
  entityId: string,
  displayName: string,
  sub: string | undefined,
  analyzeDays: number,
  datapointMinutes: number,
): { query: string; valueField: string; scale: number; isArray: boolean } {
  const fromStr = `now()-${analyzeDays}d`;
  const intervalStr = `${datapointMinutes}m`;

  if (cfg.queryType === "frontend") {
    const lbl = metricLabel.toLowerCase();
    const isErrorRate = metricKey === "dt.rum.error.count" || (lbl.includes("error") && lbl.includes("rate"));
    const isCount = (metricKey === "dt.frontend.error.count" || metricKey === "dt.rum.error.count") && !isErrorRate;
    const fieldMap: Record<string, string> = {
      "dt.frontend.web.page.largest_contentful_paint":  "web_vitals.largest_contentful_paint",
      "dt.frontend.web.page.first_contentful_paint":    "web_vitals.first_contentful_paint",
      "dt.frontend.web.page.interaction_to_next_paint": "web_vitals.interaction_to_next_paint",
      "dt.frontend.web.navigation.time_to_first_byte":  "web_vitals.time_to_first_byte",
      "dt.frontend.user_action.duration":               "duration",
      "dt.frontend.web.page.cumulative_layout_shift":   "web_vitals.cumulative_layout_shift",
      "dt.rum.useraction.largest_contentful_paint":     "web_vitals.largest_contentful_paint",
      "dt.rum.useraction.time_to_first_byte":           "web_vitals.time_to_first_byte",
      "dt.rum.useraction.interaction_to_next_paint":    "web_vitals.interaction_to_next_paint",
      "dt.rum.useraction.duration":                     "duration",
    };
    const fieldExpr = fieldMap[metricKey] ?? "duration";
    const isCls = fieldExpr === "web_vitals.cumulative_layout_shift";
    const isDurationField = fieldExpr === "duration";
    const divisor = isDurationField ? 10000000 : 1000000;
    const safeDisplay = displayName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const safeSub = sub ? sub.replace(/\\/g, "\\\\").replace(/"/g, '\\"') : null;

    // Use summarize+bin instead of makeTimeseries — makeTimeseries rejects compound
    // expressions like toLong(percentile(...))/divisor and countIf(...)/count() as aggregation args.
    const errorFields = `coalesce(error.csp_violation_count, 0) + coalesce(error.exception_count, 0) + coalesce(error.http_4xx_count, 0) + coalesce(error.http_5xx_count, 0) + coalesce(error.http_other_count, 0)`;
    const lines: string[] = [
      `fetch user.events, from:${fromStr}, to:now(), samplingRatio:1, scanLimitGBytes:500`,
      `| filterOut dt.rum.user_type == "synthetic" OR isNull(dt.rum.user_type)`,
      `| filter isNotNull(frontend.name) and frontend.name == "${safeDisplay}"`,
    ];
    if (safeSub) {
      lines.push(`| fieldsAdd cleanSub = ${CLEAN_SUB}`);
      lines.push(`| filter cleanSub == "${safeSub}"`);
    }
    if (isErrorRate) {
      lines.push(`| filter characteristics.has_page_summary or characteristics.has_w3c_navigation_timings`);
      lines.push(`| fieldsAdd __e = ${errorFields}`);
      lines.push(`| summarize errors=countIf(__e > 0), total=count(), by:{timeBucket=bin(timestamp, ${intervalStr})}`);
      lines.push(`| fieldsAdd avg = if(total > 0, errors * 100.0 / total, 0.0)`);
    } else if (isCount) {
      lines.push(`| filter characteristics.has_page_summary or characteristics.has_w3c_navigation_timings`);
      lines.push(`| fieldsAdd __e = ${errorFields}`);
      lines.push(`| summarize avg=sum(__e), by:{timeBucket=bin(timestamp, ${intervalStr})}`);
    } else if (isCls) {
      lines.push(`| filter isNotNull(${fieldExpr})`);
      lines.push(`| summarize avg=percentile(${fieldExpr}, 75), by:{timeBucket=bin(timestamp, ${intervalStr})}`);
    } else {
      lines.push(`| filter isNotNull(${fieldExpr})`);
      if (isDurationField) lines.push(`| filter isNotNull(web_vitals.largest_contentful_paint) and isFalseOrNull(characteristics.has_page_summary)`);
      lines.push(`| summarize rawAvg=toLong(percentile(${fieldExpr}, 75)), by:{timeBucket=bin(timestamp, ${intervalStr})}`);
      lines.push(`| fieldsAdd avg = rawAvg / ${divisor}`);
    }
    lines.push(`| sort timeBucket asc`);
    lines.push(`| fields avg`);
    return { query: lines.join("\n"), valueField: "avg", scale: 1, isArray: false };
  }

  // For timeseries metrics (services, hosts, k8s, etc.) — timeseries command returns val as an array
  const scale = cfg.valueMultiplier ?? 1;
  return {
    query: [
      `timeseries val=avg(${metricKey}), from:${fromStr}, to:now(), interval:${intervalStr}, by:{${cfg.entityField}}`,
      `| filter toString(${cfg.entityField}) == "${entityId}"`,
      `| fields val`,
    ].join("\n"),
    valueField: "val",
    scale,
    isArray: true,
  };
}

async function fetchEntitySparkline(query: string, valueField: string, scale: number, isArray: boolean): Promise<number[]> {
  const res = await queryExecutionClient.queryExecute({ body: { query, requestTimeoutMilliseconds: 30000 } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records: any[] = (res.result as any)?.records ?? [];
  if (records.length === 0) return [];
  if (isArray) {
    // timeseries command: single row, val is an array of bucket values
    const raw = records[0][valueField];
    if (Array.isArray(raw)) return (raw as unknown[]).map(v => Number(v) * scale).filter(isFinite);
    return [];
  }
  // summarize+bin: one row per bucket, each with a scalar value
  return records.map((r) => Number(r[valueField]) * scale).filter(isFinite);
}

// ─── Entity Diagnose Overlay ──────────────────────────────────────────────────
// Adapted from UserJourney KpiPanelOverlay (panel === "diagnose") — logic identical,
// entity context passed via label.

interface EntityDiagnoseOverlayProps {
  label: string;
  rawValue: number;
  sparkline: number[];
  color?: string;
  effectiveHigherIsBetter: boolean;
  onClose: () => void;
}

function EntityDiagnoseOverlay({ label, rawValue, sparkline, color = "#4589FF", effectiveHigherIsBetter, onClose }: EntityDiagnoseOverlayProps) {
  const valid = sparkline.filter((v) => isFinite(v) && v != null);
  const mean = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  const std = valid.length > 1 ? Math.sqrt(valid.reduce((a, v) => a + (v - mean) ** 2, 0) / valid.length) : 0;
  const curr = rawValue;
  const pMax = valid.length ? Math.max(...valid) : 0;
  const lastFew = valid.slice(-4);
  const recentTrend = lastFew.length >= 2 ? (lastFew[lastFew.length - 1] - lastFew[0]) / (lastFew[0] || 1) * 100 : 0;
  const fmt = (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v >= 10 ? v.toFixed(0) : v.toFixed(2);

  const n = valid.length;
  const isWorsening = effectiveHigherIsBetter ? recentTrend < -5 : recentTrend > 5;
  const worsePct = Math.abs(recentTrend);
  const funnelImpact = isWorsening ? Math.min(20, worsePct * 0.4) : 0;
  const peakIdx = valid.length ? valid.indexOf(Math.max(...valid)) : 0;
  const peakToMean = mean > 0 ? pMax / mean : 1;
  const peakIsMid = n > 4 && peakIdx > n * 0.2 && peakIdx < n * 0.8;
  const trafficScaling = peakIsMid && peakToMean > 1.3;
  const isBusinessOutcome = /revenue|conversion.?rate|^cr$|cvr|conv\.?\s*rate/i.test(label);

  let changePointIdx = -1;
  let maxShift = 0;
  for (let ci = 2; ci < n - 2; ci++) {
    const before = valid.slice(0, ci).reduce((a, b) => a + b, 0) / ci;
    const after = valid.slice(ci).reduce((a, b) => a + b, 0) / (n - ci);
    const shift = Math.abs(after - before);
    if (shift > maxShift) { maxShift = shift; changePointIdx = ci; }
  }
  const changeDetected = maxShift > mean * 0.12 && changePointIdx > 0;
  const changePct = mean > 0 ? (maxShift / mean) * 100 : 0;
  const changePos = changeDetected ? Math.round((changePointIdx / n) * 100) : 0;

  const p50e = mean, p75e = mean + 0.674 * std, p90e = mean + 1.282 * std, p95e = mean + 1.645 * std, p99e = mean + 2.326 * std;
  const longTail = std > 0 && p50e > 0 && p99e > p50e * 2.5;

  const velDiffs = valid.slice(1).map((v, i) => v - valid[i]);
  const velPos = velDiffs.filter(d => d > std * 0.05).length;
  const velNeg = velDiffs.filter(d => d < -std * 0.05).length;
  const monotone = velDiffs.length > 0 ? Math.max(velPos, velNeg) / velDiffs.length : 0;
  const lag4 = Math.max(2, Math.floor(n / 4));
  let acorr4Num = 0;
  const lag4Count = n > lag4 * 2 ? n - lag4 : 0;
  for (let li = 0; li < lag4Count; li++) acorr4Num += (valid[li] - mean) * (valid[li + lag4] - mean);
  const lag4Den = std * std * lag4Count;
  const acorr4 = lag4Den > 0 ? acorr4Num / lag4Den : 0;
  const zScores = valid.map(v => std > 0 ? Math.abs((v - mean) / std) : 0);
  const spikeCount = zScores.filter(z => z > 2.5).length;
  const hasSpikePattern = spikeCount >= 1 && spikeCount <= Math.max(2, Math.floor(n * 0.1));
  const trendType =
    hasSpikePattern && spikeCount <= 2 ? "One-time spike"
    : acorr4 > 0.5 ? "Cyclical / periodic"
    : monotone > 0.65 && velPos > velNeg ? (effectiveHigherIsBetter ? "Steadily improving" : "Gradually worsening")
    : monotone > 0.65 && velNeg > velPos ? (effectiveHigherIsBetter ? "Gradually declining" : "Steadily improving")
    : Math.abs(recentTrend) < 3 ? "Stable"
    : "Variable / mixed";
  const trendBad = trendType === "Gradually worsening" || trendType === "Gradually declining";
  const detThreshold = effectiveHigherIsBetter ? mean - std : mean + std;
  const nearThreshold = effectiveHigherIsBetter ? curr < detThreshold * 1.1 : curr > detThreshold * 0.9;

  const diagSc: Record<string, string> = { ok: "#0D9C29", warning: "#FFC800", critical: "#E00000", info: "#4589FF" };
  const diagSl: Record<string, string> = { ok: "OK", warning: "REVIEW", critical: "CRITICAL", info: "INFO" };

  const diagnoseScenarios = [
    { id: "traffic", icon: "🚦", title: "Traffic Scaling",
      status: trafficScaling ? "warning" : "ok",
      finding: trafficScaling ? `Peak value (${fmt(pMax)}) occurs mid-period — consistent with traffic surge impact. Peak-to-mean: ${peakToMean.toFixed(1)}x.` : `No clear mid-period peak surge. Peak-to-mean: ${peakToMean.toFixed(1)}x — scaling likely not the primary cause.`,
      rec: trafficScaling ? `Monitor when ${label} exceeds ~${fmt(mean * 1.15)}. Consider auto-scaling or caching during peak load.` : "Investigate other causes. Traffic volume scaling appears stable." },
    { id: "funnel", icon: "📉", title: isBusinessOutcome ? "Performance Drivers (Funnel Impact)" : "Funnel Exits & Conversion",
      status: isBusinessOutcome ? "info" : isWorsening ? (worsePct > 10 ? "critical" : "warning") : "ok",
      finding: isBusinessOutcome ? `${label} IS the conversion/revenue metric. Focus on what drives it: LCP, Error Rate, TTFB, INP, and Apdex have the strongest correlation.` : isWorsening ? `Recent ${worsePct.toFixed(1)}% ${effectiveHigherIsBetter ? "decline" : "increase"} may drive early funnel exits. Est. ~${funnelImpact.toFixed(1)}% conversion impact.` : `${label} is relatively stable. Low funnel exit risk at current values.`,
      rec: isBusinessOutcome ? "Use the KPI cards for LCP, Error Rate, TTFB, and INP — those metrics have the highest leverage on your conversion/revenue outcomes." : isWorsening ? `A ${worsePct.toFixed(0)}% worsening adds ~${funnelImpact.toFixed(1)}% abandonment. Check Business Analytics revenue data.` : "Continue monitoring. Set an alert if the trend reverses." },
    { id: "browser-geo", icon: "🌍", title: "Browser / Geo Specificity",
      status: "info" as const,
      finding: "Sparkline data is aggregated — browser and geo segmentation is not derivable at this level.",
      rec: "Open Dynatrace Digital Experience and break down by browser/OS and geo. Flag any segment with values 2x+ the overall average." },
    { id: "pages", icon: "📋", title: "Pages / Actions Focus",
      status: "info" as const,
      finding: "Page-level breakdown requires per-page dimension data beyond this KPI sparkline.",
      rec: "In Dynatrace, split by page/action. Prioritize pages with high traffic AND poor metric values." },
    { id: "change", icon: "🔄", title: "Change / Deployment",
      status: changeDetected ? (changePct > 20 ? "critical" : "warning") : "ok",
      finding: changeDetected ? `Significant change point at ~${changePos}% into the period. Values shifted by ~${changePct.toFixed(0)}% (${fmt(maxShift)}).` : "No significant change point detected. Values appear to transition smoothly.",
      rec: changeDetected ? `Correlate with Dynatrace release events near the ${changePos}% mark. Check Change Intelligence or Davis AI for automated RCA.` : "No deployment correlation needed. Monitor for new releases." },
    { id: "distribution", icon: "📊", title: "Performance Distribution (P50–P99)",
      status: longTail ? "warning" : "ok",
      finding: `P50: ${fmt(Math.max(0, p50e))}, P75: ${fmt(Math.max(0, p75e))}, P90: ${fmt(Math.max(0, p90e))}, P95: ${fmt(Math.max(0, p95e))}, P99: ${fmt(Math.max(0, p99e))}`,
      rec: longTail ? `High P99/P50 ratio (${(p99e / Math.max(p50e, 0.001)).toFixed(1)}x) indicates a long tail — investigate outlier sessions.` : `Distribution looks reasonable (P99/P50: ${(p99e / Math.max(p50e, 0.001)).toFixed(1)}x). Most users have a consistent experience.` },
    { id: "trend", icon: "📈", title: "Trend Pattern",
      status: trendBad ? "warning" : acorr4 > 0.5 ? "info" : "ok",
      finding: `Pattern: ${trendType}.${acorr4 > 0.3 ? ` Autocorrelation: ${(acorr4 * 100).toFixed(0)}%.` : ""}${hasSpikePattern ? ` Spike occurrences: ${spikeCount}.` : ""}`,
      rec: trendType === "One-time spike" ? "Isolated event. Verify against deployments or external events. Likely not systemic — watch for recurrence." : trendType === "Cyclical / periodic" ? "Cyclical behavior detected. Set time-based alerts aligned to the cycle." : trendBad ? "Gradual degradation in progress. Investigate root cause before it impacts more users — check for memory or resource leaks." : "Pattern is healthy or stable. Continue monitoring with existing alerts." },
    { id: "threshold", icon: "⚡", title: "Deterioration Threshold",
      status: nearThreshold ? "warning" : "ok",
      finding: `Estimated threshold: ${fmt(Math.max(0, detThreshold))} (mean ${effectiveHigherIsBetter ? "−" : "+"}1σ).${nearThreshold ? ` Current value (${fmt(curr)}) is near or past the threshold.` : ""}`,
      rec: `Set a Dynatrace alert when ${label} ${effectiveHigherIsBetter ? "falls below" : "exceeds"} ${fmt(Math.max(0, detThreshold))} to catch deterioration early.` },
  ];

  const panelSeverity = diagnoseScenarios.some(s => s.status === "critical") ? "critical" : diagnoseScenarios.some(s => s.status === "warning") ? "warning" : "ok";
  const severityColor: Record<string, string> = { ok: "#0D9C29", warning: "#FFC800", critical: "#E00000" };
  const severityLabel: Record<string, string> = { ok: "OK", warning: "REVIEW", critical: "CRITICAL" };
  const crit = diagnoseScenarios.filter(s => s.status === "critical").map(s => s.title);
  const warn = diagnoseScenarios.filter(s => s.status === "warning").map(s => s.title);
  const all = [...crit, ...warn];
  const execSummary = all.length === 0
    ? `All ${diagnoseScenarios.length} diagnostic scenarios appear healthy for ${label}.`
    : `${all.length} scenario(s) need attention: ${all.join(", ")}.`;
  const nextStep = diagnoseScenarios.find(s => s.status === "critical")?.rec
    ?? diagnoseScenarios.find(s => s.status === "warning")?.rec
    ?? "No critical issues detected. Review REVIEW-status scenarios for optimization opportunities.";

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 100010, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "rgba(20,24,46,0.98)", border: `1px solid ${color}40`, borderRadius: 12, padding: "24px 28px", maxWidth: 600, width: "90vw", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>🩺 Diagnose</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${severityColor[panelSeverity]}20`, color: severityColor[panelSeverity], letterSpacing: "0.5px", textTransform: "uppercase" as const }}>{severityLabel[panelSeverity]}</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{label}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(128,128,128,0.2)", border: "1px solid rgba(128,128,128,0.3)", borderRadius: 6, color: "#fff", padding: "4px 10px", cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>
        <div style={{ padding: "8px 12px", marginBottom: 14, background: `${severityColor[panelSeverity]}12`, borderLeft: `3px solid ${severityColor[panelSeverity]}`, borderRadius: 6, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
          {execSummary}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "50vh", overflowY: "auto", paddingRight: 4 }}>
          {diagnoseScenarios.map(s => (
            <div key={s.id} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, borderLeft: `3px solid ${diagSc[s.status]}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{s.title}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: diagSc[s.status], textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>{diagSl[s.status]}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 4 }}>{s.finding}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.42)", lineHeight: 1.5 }}>{"→"} {s.rec}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: "10px 14px", background: `${color}10`, borderLeft: `3px solid ${color}`, borderRadius: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 4 }}>Recommended Next Step</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{nextStep}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Row shape ───────────────────────────────────────────────────────────────

interface EntityRow {
  entityId: string;
  appEntityId?: string;
  displayName: string;
  sub?: string;
  avgValue: number;
  prevValue?: number;
  sessions?: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ExploreModalProps {
  metricKey: string;
  metricLabel: string;
  from: string;
  to: string;
  onClose: () => void;
}

export function ExploreModal({ metricKey, metricLabel, from, to, onClose }: ExploreModalProps) {
  const [rows, setRows] = useState<EntityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cfg = detectEntityConfig(metricKey, metricLabel);

  // ── Chip modals ────────────────────────────────────────────────────────────
  type ChipModal = { type: "forecast" | "diagnose"; row: EntityRow };
  const [activeChip, setActiveChip] = useState<ChipModal | null>(null);
  const [entitySparkline, setEntitySparkline] = useState<number[] | null>(null);
  const [sparklineLoading, setSparklineLoading] = useState(false);
  const [sparklineError, setSparklineError] = useState<string | null>(null);

  const higherIsBetter = useMemo(() => isHigherBetter(metricKey, metricLabel), [metricKey, metricLabel]);

  function openChip(type: "forecast" | "diagnose", row: EntityRow) {
    if (!cfg) return;
    setActiveChip({ type, row });
    setEntitySparkline(null);
    setSparklineError(null);
    setSparklineLoading(true);
    const { query, valueField, scale, isArray } = buildEntitySparklineQuery(metricKey, metricLabel, cfg, row.entityId, row.displayName, row.sub, 30, 15);
    fetchEntitySparkline(query, valueField, scale, isArray)
      .then((data) => { setEntitySparkline(data); })
      .catch((e) => { setSparklineError(String(e)); })
      .finally(() => setSparklineLoading(false));
  }

  function makeGetRequeryData(row: EntityRow) {
    return async (analyzeDays: number, datapointMinutes: number): Promise<number[]> => {
      if (!cfg) return [];
      const { query, valueField, scale, isArray } = buildEntitySparklineQuery(metricKey, metricLabel, cfg, row.entityId, row.displayName, row.sub, analyzeDays, datapointMinutes);
      return fetchEntitySparkline(query, valueField, scale, isArray);
    };
  }

  useEffect(() => {
    if (!cfg) return;
    setRows(null);
    setError(null);

    const currQ = buildExploreQuery(metricKey, metricLabel, cfg, from, to);
    // Previous period: same window length, shifted back — e.g. now()-4h → now()-2h
    const prevFrom = doubleFrom(from);
    const canTrend = prevFrom !== from;
    const prevQ = canTrend ? buildExploreQuery(metricKey, metricLabel, cfg, prevFrom, from) : null;

    const currPromise = queryExecutionClient.queryExecute({ body: { query: currQ, requestTimeoutMilliseconds: 30000 } });
    const prevPromise = prevQ
      ? queryExecutionClient.queryExecute({ body: { query: prevQ, requestTimeoutMilliseconds: 30000 } })
      : Promise.resolve(null);

    Promise.all([currPromise, prevPromise])
      .then(([currRes, prevRes]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currRecords: any[] = (currRes.result as any)?.records ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prevRecords: any[] = prevRes ? ((prevRes.result as any)?.records ?? []) : [];

        // Index previous period by displayName|sub for delta lookup
        const prevMap = new Map<string, number>();
        prevRecords.forEach((rec) => {
          const key = `${rec["displayName"]}|${rec["sub"] ?? ""}`;
          prevMap.set(key, Number(rec["avg"] ?? 0));
        });

        const parsed: EntityRow[] = currRecords.map((rec) => {
          const key = `${rec["displayName"]}|${rec["sub"] ?? ""}`;
          return {
            entityId: String(rec["entityId"] ?? rec[cfg.entityField] ?? ""),
            appEntityId: rec["appEntityId"] ? String(rec["appEntityId"]) : undefined,
            displayName: String(rec["displayName"] ?? rec["entityId"] ?? "Unknown"),
            sub: rec["sub"] ? String(rec["sub"]) : undefined,
            avgValue: Number(rec["avg"] ?? rec["avgValue"] ?? 0),
            prevValue: prevMap.has(key) ? prevMap.get(key)! : undefined,
            sessions: rec["sessions"] != null ? Number(rec["sessions"]) : undefined,
          };
        }).filter((r) => r.entityId || r.displayName !== "Unknown");

        setRows(parsed);
      })
      .catch((e) => setError(String(e)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricKey, from, to]);

  let envUrl = "";
  try { envUrl = getEnvironmentUrl(); } catch { /* noop */ }

  const modal = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#1A1D23", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, width: 520, maxWidth: "94vw", maxHeight: "72vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#E0E6F0" }}>Follow the Red — {metricLabel}</div>
            {cfg && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Top impacted {cfg.appLabel.toLowerCase()} · click a chip to drill down</div>}
            {!cfg && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Custom DQL metric — no entity drill-down available</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
          {cfg && rows === null && !error && (
            <div style={{ padding: "24px 16px", color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center" }}>
              Querying {cfg.appLabel.toLowerCase()}…
            </div>
          )}
          {cfg && error && (
            <div style={{ padding: "20px 16px", color: "#F87171", fontSize: 12 }}>Query failed: {error}</div>
          )}
          {cfg && rows !== null && rows.length === 0 && (
            <div style={{ padding: "20px 16px", color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center" }}>No data returned for this metric in the selected timeframe.</div>
          )}
          {cfg && rows !== null && rows.map((row, i) => {
            const delta = (row.prevValue != null && row.prevValue > 0)
              ? (row.avgValue - row.prevValue) / row.prevValue * 100
              : null;
            const showDelta = delta != null && Math.abs(delta) >= 2;
            const worsening = delta != null && delta > 2;
            return (
              <div
                key={i}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px" }}
              >
                <div style={{ width: 20, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#C9D8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.displayName}</div>
                  {row.sub && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.sub}</div>}
                  {row.sessions != null && row.sessions > 0 && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 1 }}>{formatCount(row.sessions)} sessions</div>
                  )}
                </div>
                {showDelta && (
                  <div style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, background: worsening ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)", color: worsening ? "#F87171" : "#34D399", flexShrink: 0, fontWeight: 600 }}>
                    {worsening ? "▲" : "▼"} {Math.abs(delta!).toFixed(0)}%
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? "#FF3D9A" : i < 3 ? "#FFF04D" : "#10B981", flexShrink: 0 }}>
                  {formatVal(row.avgValue, cfg.valueUnit)}
                </div>
                {/* Action chips */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEntity(envUrl, row.entityId, cfg, row.displayName, row.appEntityId, row.sub); }}
                    style={{ background: "rgba(69,137,255,0.12)", border: "1px solid rgba(69,137,255,0.3)", borderRadius: 5, color: "#7ab4ff", fontSize: 10, padding: "2px 7px", cursor: "pointer", whiteSpace: "nowrap" }}
                    title="Open in Dynatrace"
                  >Open in Dynatrace</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openChip("forecast", row); }}
                    style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 5, color: "#a5b4fc", fontSize: 10, padding: "2px 7px", cursor: "pointer" }}
                    title="Forecast this metric for this entity"
                  >Forecast</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openChip("diagnose", row); }}
                    style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 5, color: "#6ee7b7", fontSize: 10, padding: "2px 7px", cursor: "pointer" }}
                    title="Diagnose this metric for this entity"
                  >Diagnose</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {cfg && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginBottom: 8, lineHeight: 1.5 }}>
              % chips compare <strong style={{ color: "rgba(255,255,255,0.4)" }}>current timeframe vs. previous equal-length timeframe</strong> &nbsp;·&nbsp; <span style={{ color: "#F87171" }}>▲</span> worsened &nbsp;·&nbsp; <span style={{ color: "#34D399" }}>▼</span> improved &nbsp;·&nbsp; no chip = stable (&lt;2%) or no prior data
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => openEntity(envUrl, "", cfg)}
                style={{ background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.3)", borderRadius: 6, color: "#7ab4ff", fontSize: 12, padding: "5px 12px", cursor: "pointer" }}
              >
                Open {cfg.appLabel} →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Chip modal overlays ─────────────────────────────────────────────────────
  const chipRow = activeChip?.row;
  const chipLabel = chipRow ? `${metricLabel} — ${chipRow.displayName}${chipRow.sub ? ` / ${chipRow.sub}` : ""}` : metricLabel;

  return (
    <>
      {createPortal(modal, document.body)}

      {/* Forecast modal */}
      {activeChip?.type === "forecast" && chipRow && (
        sparklineLoading ? createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 100011, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "#1A1D23", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "24px 32px", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Loading forecast data…</div>
          </div>,
          document.body
        ) : sparklineError ? createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 100011, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setActiveChip(null)}>
            <div style={{ background: "#1A1D23", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "24px 32px", color: "#F87171", fontSize: 13 }}>Failed to load sparkline: {sparklineError}</div>
          </div>,
          document.body
        ) : entitySparkline ? (
          <ForecastModal
            label={chipLabel}
            sparkline={entitySparkline.length > 0 ? entitySparkline : [chipRow.avgValue]}
            color="#4589FF"
            fromMs={Date.now() - 30 * 24 * 3600 * 1000}
            toMs={Date.now()}
            onClose={() => setActiveChip(null)}
            getRequeryData={makeGetRequeryData(chipRow)}
          />
        ) : null
      )}

      {/* Diagnose overlay */}
      {activeChip?.type === "diagnose" && chipRow && (
        sparklineLoading ? createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 100011, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "#1A1D23", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "24px 32px", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Running diagnostics…</div>
          </div>,
          document.body
        ) : sparklineError ? createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 100011, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setActiveChip(null)}>
            <div style={{ background: "#1A1D23", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "24px 32px", color: "#F87171", fontSize: 13 }}>Failed to load data: {sparklineError}</div>
          </div>,
          document.body
        ) : entitySparkline ? (
          <EntityDiagnoseOverlay
            label={chipLabel}
            rawValue={chipRow.avgValue}
            sparkline={entitySparkline.length > 0 ? entitySparkline : [chipRow.avgValue]}
            color="#4589FF"
            effectiveHigherIsBetter={higherIsBetter}
            onClose={() => setActiveChip(null)}
          />
        ) : null
      )}
    </>
  );
}
