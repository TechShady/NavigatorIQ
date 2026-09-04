import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";
import type { HeatBucketDetail, HeatBucketMetric, PersonaId, HeatMetricConfig } from "../types";
import type { DavisProblemsResult } from "../queries";

// ─── Analysis ─────────────────────────────────────────────────────────────

export interface HotnessAnalysis {
  summary: string;
  worstIdx: number;
  worstZ: number;
  bestIdx: number;
  bestZ: number;
  hotBuckets: number;
  criticalBuckets: number;
  maxConsecutiveHot: number;
  burstType: "stable" | "transient" | "sustained" | "chronic";
  worstDriver: string;
  worstMetrics: HeatBucketMetric[];
  bestMetrics: HeatBucketMetric[];
  insights: Array<{ severity: "critical" | "warning" | "info" | "good"; icon: string; text: string }>;
}

export function analyzeHotness(
  heatScores: number[],
  bucketDetails: HeatBucketDetail[],
  bucketLabel: string,
): HotnessAnalysis {
  if (heatScores.length === 0) {
    return {
      summary: "No hotness data available for this timeframe.", worstIdx: 0, worstZ: 0,
      bestIdx: 0, bestZ: 0, hotBuckets: 0, criticalBuckets: 0, maxConsecutiveHot: 0,
      burstType: "stable", worstDriver: "N/A", worstMetrics: [], bestMetrics: [],
      insights: [{ severity: "info", icon: "ℹ️", text: "Collect more data to enable Hotness Assist analysis." }],
    };
  }

  let worstIdx = 0, bestIdx = 0;
  for (let i = 0; i < heatScores.length; i++) {
    if (heatScores[i] > heatScores[worstIdx]) worstIdx = i;
    if (heatScores[i] < heatScores[bestIdx]) bestIdx = i;
  }

  const worstZ = heatScores[worstIdx] ?? 0;
  const bestZ = heatScores[bestIdx] ?? 0;
  const worstMetrics = bucketDetails[worstIdx]?.metrics ?? [];
  const bestMetrics = bucketDetails[bestIdx]?.metrics ?? [];

  const perfMetrics = worstMetrics.filter((m) => !m.isTraffic && m.zScore > 0).sort((a, b) => b.zScore - a.zScore);
  let worstDriver = "Mixed issues";
  if (perfMetrics.length > 0) {
    const top = perfMetrics[0];
    worstDriver = top.zScore >= 2.5 ? `${top.label} critical spike` : top.zScore >= 1.5 ? `${top.label} elevated` : `${top.label} anomaly`;
  } else if (worstZ < 0.75) {
    worstDriver = "Within normal range";
  }

  let hotBuckets = 0, criticalBuckets = 0;
  for (const z of heatScores) {
    if (z >= 0.75) hotBuckets++;
    if (z >= 2.5) criticalBuckets++;
  }

  let maxRun = 0, currentRun = 0;
  for (const z of heatScores) {
    if (z >= 0.75) { currentRun++; maxRun = Math.max(maxRun, currentRun); }
    else currentRun = 0;
  }
  const burstType: HotnessAnalysis["burstType"] =
    maxRun === 0 ? "stable" : maxRun <= 2 ? "transient" : maxRun <= 5 ? "sustained" : "chronic";

  const insights: HotnessAnalysis["insights"] = [];

  if (worstZ >= 2.5) {
    const metricNote = perfMetrics[0] ? ` ${perfMetrics[0].label}: ${perfMetrics[0].displayValue} (+${perfMetrics[0].zScore.toFixed(1)}σ).` : "";
    insights.push({ severity: "critical", icon: "🔥", text: `Critical spike at bucket ${worstIdx + 1} (Z=${worstZ.toFixed(1)}) driven by ${worstDriver.toLowerCase()}.${metricNote}` });
  } else if (worstZ >= 1.5) {
    insights.push({ severity: "warning", icon: "⚠️", text: `Elevated activity at bucket ${worstIdx + 1} (Z=${worstZ.toFixed(1)}) — ${worstDriver.toLowerCase()}.` });
  } else if (worstZ >= 0.75) {
    insights.push({ severity: "info", icon: "📈", text: `Peak at bucket ${worstIdx + 1} (Z=${worstZ.toFixed(1)}) remained in tolerable range.` });
  } else {
    insights.push({ severity: "good", icon: "✅", text: `All ${heatScores.length} buckets within normal operating range — no elevated activity detected.` });
  }

  if (bestZ < 0.5 && worstZ >= 1.0) {
    const bestNote = bestMetrics[0] ? ` — ${bestMetrics[0].label}: ${bestMetrics[0].displayValue}` : "";
    insights.push({ severity: "good", icon: "✨", text: `Best conditions at bucket ${bestIdx + 1} (Z=${bestZ.toFixed(2)})${bestNote}. Use as your SLO performance baseline.` });
  }

  if (burstType === "chronic") {
    insights.push({ severity: "critical", icon: "⏳", text: `Chronic degradation: ${maxRun} consecutive elevated buckets. Systemic issue requiring active remediation.` });
  } else if (burstType === "sustained") {
    insights.push({ severity: "warning", icon: "⏱️", text: `Sustained degradation: ${maxRun} consecutive elevated buckets. Monitor for recurrence.` });
  } else if (burstType === "transient") {
    insights.push({ severity: "info", icon: "⚡", text: `Transient spike — ${maxRun} consecutive hot bucket${maxRun !== 1 ? "s" : ""}, self-resolved.` });
  }

  if (criticalBuckets > 0) {
    insights.push({ severity: "critical", icon: "🚨", text: `${criticalBuckets} bucket${criticalBuckets !== 1 ? "s" : ""} reached critical spike level (Z≥2.5) — highest priority for investigation.` });
  }

  const spikeSummary = criticalBuckets > 0
    ? `${hotBuckets} bucket${hotBuckets !== 1 ? "s" : ""} elevated including ${criticalBuckets} critical spike${criticalBuckets !== 1 ? "s" : ""}`
    : hotBuckets > 0 ? `${hotBuckets} bucket${hotBuckets !== 1 ? "s" : ""} elevated`
    : "all buckets within normal operating range";
  const burstDesc = burstType !== "stable" ? ` (${burstType} pattern, max ${maxRun} consecutive)` : "";
  const summary = `Analyzed ${heatScores.length} ${bucketLabel} bucket${heatScores.length !== 1 ? "s" : ""}. ${spikeSummary.charAt(0).toUpperCase() + spikeSummary.slice(1)}${burstDesc}. Worst: bucket ${worstIdx + 1} (Z=${worstZ.toFixed(1)}, driver: ${worstDriver}). Best: bucket ${bestIdx + 1} (Z=${bestZ.toFixed(2)}).`;

  return { summary, worstIdx, worstZ, bestIdx, bestZ, hotBuckets, criticalBuckets, maxConsecutiveHot: maxRun, burstType, worstDriver, worstMetrics, bestMetrics, insights };
}

// ─── Button ────────────────────────────────────────────────────────────────

export function HotnessAssistButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Hotness Assist — full analysis of this persona's heat pattern"
      style={{
        display: "flex", alignItems: "center", gap: 5,
        background: hover ? "rgba(255,120,30,0.28)" : "rgba(255,120,30,0.15)",
        border: "1px solid rgba(255,120,30,0.55)", borderRadius: 6,
        color: "#FF8C42", fontSize: 11, fontWeight: 700, padding: "4px 10px",
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      🔥 Hotness Assist
    </button>
  );
}

// ─── Animated summary text ─────────────────────────────────────────────────

function AnimatedSummary({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const lastText = useRef("");
  useEffect(() => { if (lastText.current !== text) { lastText.current = text; setDisplayed(""); } }, [text]);
  useEffect(() => {
    if (displayed.length >= text.length) return;
    const id = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 3)), 14);
    return () => clearTimeout(id);
  }, [displayed, text]);
  const done = displayed.length >= text.length;
  return (
    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 1.75 }}>
      {displayed}
      {!done && <span style={{ color: "#FF8C42", animation: "ha-blink 0.8s step-end infinite" }}>|</span>}
      <style>{`@keyframes ha-blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}

// ─── Mini hotness chart ────────────────────────────────────────────────────

function MiniHotnessChart({ scores, worstIdx, bestIdx }: { scores: number[]; worstIdx: number; bestIdx: number }) {
  if (scores.length < 2) return null;
  const W = 640, H = 72, LH = 14;
  const maxZ = Math.max(...scores, 1);
  const barW = Math.max(2, W / scores.length - 1);
  const color = (z: number) => z >= 2.5 ? "#FF073A" : z >= 1.5 ? "#FF3D9A" : z >= 0.75 ? "#FFF04D" : "#4589FF";
  const xOf = (i: number) => (i / Math.max(scores.length - 1, 1)) * (W - barW);
  const bH = (z: number) => Math.max(3, (z / maxZ) * H);
  return (
    <svg width={W} height={H + LH} style={{ display: "block", borderRadius: 6, background: "rgba(255,255,255,0.03)" }}>
      {scores.map((z, i) => (
        <rect key={i} x={xOf(i)} y={H - bH(z)} width={barW} height={bH(z)} fill={color(z)} opacity={0.85} rx={1} />
      ))}
      {scores.map((z, i) => {
        if (i !== worstIdx && i !== bestIdx) return null;
        const isWorst = i === worstIdx;
        const cx = xOf(i) + barW / 2;
        return (
          <g key={`marker-${i}`}>
            <line x1={cx} y1={0} x2={cx} y2={H} stroke={isWorst ? "#FF073A" : "#10B981"} strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
            <text x={cx} y={H + LH - 2} textAnchor="middle" fill={isWorst ? "#FF073A" : "#10B981"} fontSize={9} fontWeight="bold">{isWorst ? "▲worst" : "▽best"}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Metric row for worst/best cards ─────────────────────────────────────

function MetricRow({ m }: { m: HeatBucketMetric }) {
  const barColor = m.isTraffic
    ? "#4589FF"
    : m.zScore <= 0 ? "#10B981"
    : m.zScore >= 2.5 ? "#FF073A"
    : m.zScore >= 1.5 ? "#FF3D9A"
    : m.zScore >= 0.75 ? "#FFF04D" : "#4589FF";
  const barW = Math.min(100, Math.abs(m.zScore) / 3 * 100);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{m.label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: barColor }}>{m.displayValue}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
          <div style={{ width: `${barW}%`, height: "100%", background: barColor, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 10, color: barColor, width: 36, textAlign: "right" }}>{m.zScore > 0 ? "+" : ""}{m.zScore.toFixed(1)}σ</span>
      </div>
    </div>
  );
}

// ─── Gap table ─────────────────────────────────────────────────────────────

function GapTable({ worstMetrics, bestMetrics }: { worstMetrics: HeatBucketMetric[]; bestMetrics: HeatBucketMetric[] }) {
  if (worstMetrics.length === 0 || bestMetrics.length === 0) return null;
  const rows = worstMetrics.map((wm) => {
    const bm = bestMetrics.find((b) => b.label === wm.label);
    return { label: wm.label, worstVal: wm.displayValue, bestVal: bm?.displayValue ?? "—", delta: wm.zScore - (bm?.zScore ?? 0), worstZ: wm.zScore, isTraffic: wm.isTraffic };
  });
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Worst vs Best Gap</div>
      <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 0 }}>
          {["Metric", "Worst", "Best", "Δ Z-score"].map((h) => (
            <div key={h} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.04)", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>{h}</div>
          ))}
          {rows.map((row, i) => {
            const gapColor = !row.isTraffic && row.delta > 1 ? "#FF3D9A" : !row.isTraffic && row.delta > 0.5 ? "#FFF04D" : "rgba(255,255,255,0.6)";
            return (
              <React.Fragment key={i}>
                <div style={{ padding: "7px 10px", fontSize: 12, color: "rgba(255,255,255,0.75)", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>{row.label}</div>
                <div style={{ padding: "7px 10px", fontSize: 12, fontWeight: 600, color: row.isTraffic ? "#4589FF" : (row.worstZ >= 1.5 ? "#FF3D9A" : row.worstZ >= 0.75 ? "#FFF04D" : "rgba(255,255,255,0.6)"), borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>{row.worstVal}</div>
                <div style={{ padding: "7px 10px", fontSize: 12, color: "#10B981", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>{row.bestVal}</div>
                <div style={{ padding: "7px 10px", fontSize: 12, fontWeight: 700, color: gapColor, borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>{row.delta > 0 ? "+" : ""}{row.delta.toFixed(1)}</div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Panel ─────────────────────────────────────────────────────────────────

export interface HotnessAssistPanelProps {
  heatScores: number[];
  bucketDetails: HeatBucketDetail[];
  bucketLabel: string;
  persona?: PersonaId;
  heatMetrics?: HeatMetricConfig[];
  problems?: DavisProblemsResult | null;
  intervalMinutes?: number;
  pos: { x: number; y: number };
  onDragStart: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClose: () => void;
}

// ─── Next Steps logic ──────────────────────────────────────────────────────

interface NextStepEntry {
  label: string;
  appPath: string;
  severity: "critical" | "warning";
  reason: string;
  repoUrl?: string;
}

function formatThresholdDisplay(value: number, metric: HeatMetricConfig): string {
  const suffix = metric.displaySuffix?.trim();
  if (suffix) return `${Math.round(value * 100) / 100}${suffix}`;
  switch (metric.displayUnit) {
    case "pct": return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
    case "ms":
    case "ns->ms":
    case "µs->ms": {
      if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
      return `${Math.round(value)}ms`;
    }
    default: return String(Math.round(value * 100) / 100);
  }
}

function buildNextSteps(
  heatMetrics: HeatMetricConfig[],
  bucketDetails: HeatBucketDetail[],
  intervalMinutes: number,
): NextStepEntry[] {
  // Build peak (max) and valley (min) maps per metric label
  const peaks: Record<string, { value: number; displayValue: string }> = {};
  const valleys: Record<string, { value: number; displayValue: string }> = {};
  for (const detail of bucketDetails) {
    for (const m of detail.metrics) {
      if (!peaks[m.label] || m.value > peaks[m.label].value) peaks[m.label] = { value: m.value, displayValue: m.displayValue };
      if (!valleys[m.label] || m.value < valleys[m.label].value) valleys[m.label] = { value: m.value, displayValue: m.displayValue };
    }
  }

  const entries: NextStepEntry[] = [];
  for (const metric of heatMetrics) {
    if (!metric.exploreAppPath || metric.isTraffic) continue;
    if (metric.warningThreshold === undefined && metric.criticalThreshold === undefined) continue;

    // Convention: warningThreshold > criticalThreshold → high is good (inverted direction)
    const inverted = metric.warningThreshold !== undefined && metric.criticalThreshold !== undefined
      && metric.warningThreshold > metric.criticalThreshold;

    const candidate = inverted ? valleys[metric.label] : peaks[metric.label];
    if (!candidate) continue;

    const scale = (!inverted && metric.thresholdBucketHours !== undefined && metric.thresholdBucketHours > 0)
      ? intervalMinutes / (metric.thresholdBucketHours * 60)
      : 1;

    let severity: "critical" | "warning" | null = null;
    let thresholdDisplay = "";

    if (inverted) {
      // High is good — alert when value drops BELOW threshold
      if (metric.criticalThreshold !== undefined && candidate.value <= metric.criticalThreshold) {
        severity = "critical";
        thresholdDisplay = formatThresholdDisplay(metric.criticalThreshold, metric);
      } else if (metric.warningThreshold !== undefined && candidate.value <= metric.warningThreshold) {
        severity = "warning";
        thresholdDisplay = formatThresholdDisplay(metric.warningThreshold, metric);
      }
      if (severity) {
        entries.push({ label: metric.label, appPath: metric.exploreAppPath!, severity, repoUrl: metric.repoUrl,
          reason: `Min ${metric.label}: ${candidate.displayValue} — drops below ${severity} threshold of ${thresholdDisplay}` });
      }
    } else {
      const effectiveWarning = (metric.warningThreshold ?? Infinity) * scale;
      const effectiveCritical = (metric.criticalThreshold ?? Infinity) * scale;
      if (metric.criticalThreshold !== undefined && candidate.value >= effectiveCritical) {
        severity = "critical";
        const raw = formatThresholdDisplay(metric.criticalThreshold, metric);
        thresholdDisplay = metric.thresholdBucketHours
          ? `${raw}/hr${scale < 1 ? ` (${formatThresholdDisplay(effectiveCritical, metric)} at ${intervalMinutes}-min interval)` : ""}`
          : raw;
      } else if (metric.warningThreshold !== undefined && candidate.value >= effectiveWarning) {
        severity = "warning";
        const raw = formatThresholdDisplay(metric.warningThreshold, metric);
        thresholdDisplay = metric.thresholdBucketHours
          ? `${raw}/hr${scale < 1 ? ` (${formatThresholdDisplay(effectiveWarning, metric)} at ${intervalMinutes}-min interval)` : ""}`
          : raw;
      }
      if (severity) {
        entries.push({ label: metric.label, appPath: metric.exploreAppPath!, severity, repoUrl: metric.repoUrl,
          reason: `Peak ${metric.label}: ${candidate.displayValue} — exceeds ${severity} threshold of ${thresholdDisplay}` });
      }
    }
  }

  // Critical first, then warning
  return entries.sort((a, b) => (a.severity === "critical" ? -1 : 1) - (b.severity === "critical" ? -1 : 1));
}

const INSIGHT_COLORS: Record<HotnessAnalysis["insights"][0]["severity"], string> = {
  critical: "#FF073A", warning: "#FFF04D", info: "#4589FF", good: "#10B981",
};

// Probes each app by loading its icon.svg as an <img>.
// Deployed apps serve a real SVG; non-deployed paths return the HTML SPA shell,
// which fails image decoding → onerror → status false.
// img-src CSP is explicitly widened to *.apps.dynatrace.com in app.config.json.
function useAppDeploymentStatuses(appIds: string[]): Record<string, boolean> {
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const key = appIds.join(",");
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let envUrl = "";
    try { envUrl = getEnvironmentUrl(); } catch { /* relative fallback */ }
    const cleanups: Array<() => void> = [];
    for (const appId of appIds) {
      const img = new window.Image();
      let settled = false;
      const timer = setTimeout(() => {
        if (cancelled || settled) return;
        settled = true;
        img.onload = img.onerror = null;
      }, 5000);
      img.onload = () => {
        if (cancelled || settled) return;
        settled = true;
        clearTimeout(timer);
        setStatuses(prev => ({ ...prev, [appId]: true }));
      };
      img.onerror = () => {
        if (cancelled || settled) return;
        settled = true;
        clearTimeout(timer);
        setStatuses(prev => ({ ...prev, [appId]: false }));
      };
      img.src = `${envUrl}/ui/apps/${appId}/icon.svg?_probe=${Date.now()}`;
      cleanups.push(() => { clearTimeout(timer); img.onload = img.onerror = null; });
    }
    return () => { cancelled = true; cleanups.forEach(fn => fn()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return statuses;
}

export function HotnessAssistPanel({ heatScores, bucketDetails, bucketLabel, persona: _persona, heatMetrics, problems, intervalMinutes = 5, pos, onDragStart, onClose }: HotnessAssistPanelProps) {
  const analysis = analyzeHotness(heatScores, bucketDetails, bucketLabel);

  // Compute steps here so the probe hook can be called at component level
  const steps = useMemo(
    () => heatMetrics && heatMetrics.length > 0 ? buildNextSteps(heatMetrics, bucketDetails, intervalMinutes) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heatMetrics, bucketDetails, intervalMinutes],
  );
  const customAppIds = useMemo(
    () => [...new Set(steps.filter(s => s.repoUrl).map(s => s.appPath))],
    [steps],
  );
  const deploymentStatuses = useAppDeploymentStatuses(customAppIds);
  const burstLabels: Record<HotnessAnalysis["burstType"], string> = {
    stable: "Stable — no elevated activity",
    transient: "Transient spike — self-resolved",
    sustained: "Sustained degradation",
    chronic: "Chronic degradation",
  };
  const burstColors: Record<HotnessAnalysis["burstType"], string> = {
    stable: "#10B981", transient: "#4589FF", sustained: "#FFF04D", chronic: "#FF073A",
  };

  return createPortal(
    <div style={{
      position: "fixed", left: pos.x, top: pos.y, zIndex: 9991, width: 700,
      background: "rgba(14,18,36,0.97)", border: "1px solid rgba(255,120,30,0.35)",
      borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.78)",
      fontFamily: '"Inter",system-ui,sans-serif', color: "#e8eeff",
      backdropFilter: "blur(16px)", maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div onMouseDown={onDragStart} style={{
        cursor: "grab", padding: "13px 20px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        userSelect: "none", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>🔥</span>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: 0.4 }}>Hotness Assist</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>drag to move</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 24, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>×</button>
      </div>

      <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* KPI Tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { label: "Hot Buckets", value: String(analysis.hotBuckets), color: analysis.hotBuckets > 0 ? "#FFF04D" : "#10B981" },
            { label: "Critical Spikes", value: String(analysis.criticalBuckets), color: analysis.criticalBuckets > 0 ? "#FF073A" : "#10B981" },
            { label: "Worst Z-score", value: analysis.worstZ.toFixed(2) + "σ", color: analysis.worstZ >= 2.5 ? "#FF073A" : analysis.worstZ >= 1.5 ? "#FF3D9A" : analysis.worstZ >= 0.75 ? "#FFF04D" : "#4589FF" },
            { label: "Best Z-score", value: analysis.bestZ.toFixed(2) + "σ", color: "#10B981" },
          ].map((kpi) => (
            <div key={kpi.label} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${kpi.color}25`, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color, lineHeight: 1.1 }}>{kpi.value}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4, fontWeight: 600, letterSpacing: "0.06em" }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div style={{ background: "linear-gradient(135deg, rgba(255,120,30,0.07) 0%, rgba(255,60,0,0.04) 100%)", border: "1px solid rgba(255,120,30,0.2)", borderLeft: "3px solid #FF8C42", borderRadius: "0 10px 10px 0", padding: "12px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FF8C42", marginBottom: 8 }}>🔥 Hotness Assist Analysis</div>
          <AnimatedSummary text={analysis.summary} />
        </div>

        {/* Mini chart */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Hotness Timeline · {heatScores.length} {bucketLabel} buckets</div>
          <MiniHotnessChart scores={heatScores} worstIdx={analysis.worstIdx} bestIdx={analysis.bestIdx} />
        </div>

        {/* Pattern card */}
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Activity Pattern</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: burstColors[analysis.burstType] }}>{burstLabels[analysis.burstType]}</div>
              {analysis.maxConsecutiveHot > 0 && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
                  Max {analysis.maxConsecutiveHot} consecutive hot bucket{analysis.maxConsecutiveHot !== 1 ? "s" : ""}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Primary driver</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#FF8C42" }}>{analysis.worstDriver}</div>
            </div>
          </div>
        </div>

        {/* Worst vs Best bucket cards */}
        {(analysis.worstMetrics.length > 0 || analysis.bestMetrics.length > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "rgba(255,7,58,0.06)", border: "1px solid rgba(255,7,58,0.2)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FF073A", marginBottom: 10 }}>▲ Worst — Bucket {analysis.worstIdx + 1} (Z={analysis.worstZ.toFixed(2)})</div>
              {analysis.worstMetrics.map((m, i) => <MetricRow key={i} m={m} />)}
            </div>
            <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#10B981", marginBottom: 10 }}>▽ Best — Bucket {analysis.bestIdx + 1} (Z={analysis.bestZ.toFixed(2)})</div>
              {analysis.bestMetrics.map((m, i) => <MetricRow key={i} m={m} />)}
            </div>
          </div>
        )}

        {/* Gap table */}
        <GapTable worstMetrics={analysis.worstMetrics} bestMetrics={analysis.bestMetrics} />

        {/* Insights */}
        {analysis.insights.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Insights & Recommendations</div>
            {analysis.insights.map((ins, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "9px 12px", marginBottom: 6, background: `${INSIGHT_COLORS[ins.severity]}08`, border: `1px solid ${INSIGHT_COLORS[ins.severity]}25`, borderRadius: 8 }}>
                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{ins.icon}</span>
                <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.55 }}>{ins.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Davis Problems */}
        {problems && problems.count > 0 && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
              ⚠️ Davis Problems · {problems.count} Open
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {problems.titles.slice(0, 5).map((title, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 11px", background: "rgba(255,7,58,0.07)", border: "1px solid rgba(255,7,58,0.25)", borderRadius: 7 }}>
                  <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>🔴</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.82)", lineHeight: 1.5 }}>{title}</span>
                </div>
              ))}
              {problems.count > 5 && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", padding: "4px 11px" }}>
                  + {problems.count - 5} more open problem{problems.count - 5 !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Next Steps */}
        {steps.length >= 0 && heatMetrics && heatMetrics.length > 0 && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Next Steps</div>
            {steps.length === 0 ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", padding: "8px 0" }}>
                All heat metrics are within configured thresholds — no specific actions required.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {steps.map((step, i) => {
                  const isCrit = step.severity === "critical";
                  const color = isCrit ? "#FF073A" : "#FFF04D";
                  // Show GitHub link when app has a repoUrl AND deployment probe has not confirmed it as deployed
                  const showGitHub = !!step.repoUrl && deploymentStatuses[step.appPath] !== true;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", background: `${color}08`, border: `1px solid ${color}25`, borderRadius: 8 }}>
                      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{isCrit ? "🔴" : "⚠️"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.82)", lineHeight: 1.5, marginBottom: 6 }}>{step.reason}</div>
                        {showGitHub ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <button
                              onClick={() => {
                                try { window.open(`${getEnvironmentUrl()}/ui/apps/${step.appPath}`, "_blank"); }
                                catch { window.open(`/ui/apps/${step.appPath}`, "_blank"); }
                              }}
                              style={{ background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 5, color, fontSize: 11, fontWeight: 600, padding: "4px 10px", cursor: "pointer" }}
                            >
                              ↗ Investigate {step.label}
                            </button>
                            <a
                              href={step.repoUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: 11, color: "#4589FF", fontWeight: 600, textDecoration: "underline", cursor: "pointer", whiteSpace: "nowrap" }}
                            >
                              ↗ Deploy from GitHub
                            </a>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              try { window.open(`${getEnvironmentUrl()}/ui/apps/${step.appPath}`, "_blank"); }
                              catch { window.open(`/ui/apps/${step.appPath}`, "_blank"); }
                            }}
                            style={{ background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 5, color, fontSize: 11, fontWeight: 600, padding: "4px 10px", cursor: "pointer" }}
                          >
                            ↗ Investigate {step.label}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
