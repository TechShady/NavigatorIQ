import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";
import { useUserAppState, useSetUserAppState } from "@dynatrace-sdk/react-hooks";
import type { HeatBucketDetail, HeatBucketMetric, PersonaId, HeatMetricConfig } from "../types";
import type { DavisProblemsResult } from "../queries";

const INSTALLED_APPS_KEY = "iq-installed-apps-v1";

function parseInstalledApps(raw: string | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

// ─── Analysis ─────────────────────────────────────────────────────────────

export interface HotnessAnalysis {
  summary: string;
  worstIdx: number;
  worstZ: number;
  worst2Idx: number;
  worst2Z: number;
  bestIdx: number;
  bestZ: number;
  best2Idx: number;
  best2Z: number;
  hotBuckets: number;
  criticalBuckets: number;
  maxConsecutiveHot: number;
  burstType: "stable" | "transient" | "sustained" | "chronic";
  worstDriver: string;
  worstMetrics: HeatBucketMetric[];
  worst2Metrics: HeatBucketMetric[];
  bestMetrics: HeatBucketMetric[];
  best2Metrics: HeatBucketMetric[];
  usableCount: number;
  alertPattern: "deployment" | "load-induced" | "infrastructure" | "unknown";
  recommendations: Array<{ impact: "high" | "medium" | "low"; text: string }>;
  insights: Array<{ severity: "critical" | "warning" | "info" | "good"; icon: string; text: string }>;
  episodeCount: number;
  longestEpisodeBuckets: number;
  avgRecoveryBuckets: number;
  driftSlope: number;
  driftLabel: "worsening" | "stable" | "improving";
}

export function analyzeHotness(
  heatScores: number[],
  bucketDetails: HeatBucketDetail[],
  bucketLabel: string,
): HotnessAnalysis {
  if (heatScores.length === 0) {
    return {
      summary: "No hotness data available for this timeframe.",
      worstIdx: 0, worstZ: 0, worst2Idx: 0, worst2Z: 0,
      bestIdx: 0, bestZ: 0, best2Idx: 0, best2Z: 0,
      hotBuckets: 0, criticalBuckets: 0, maxConsecutiveHot: 0,
      burstType: "stable", worstDriver: "N/A",
      worstMetrics: [], worst2Metrics: [], bestMetrics: [], best2Metrics: [],
      usableCount: 0,
      alertPattern: "unknown",
      recommendations: [],
      insights: [{ severity: "info", icon: "ℹ️", text: "Collect more data to enable Hotness Assist analysis." }],
      episodeCount: 0, longestEpisodeBuckets: 0, avgRecoveryBuckets: 0, driftSlope: 0, driftLabel: "stable" as const,
    };
  }

  // Drop the last bucket — it may be a partial/incomplete interval
  const usable = heatScores.length > 1 ? heatScores.slice(0, -1) : heatScores;
  const usableDetails = bucketDetails.length > 1 ? bucketDetails.slice(0, -1) : bucketDetails;

  // Find top-2 worst (highest z) and top-2 best (lowest z)
  const ranked = usable.map((z, i) => ({ z, i })).sort((a, b) => b.z - a.z);
  const worstIdx = ranked[0]?.i ?? 0;
  const worst2Idx = ranked.length > 1 ? (ranked[1]?.i ?? worstIdx) : worstIdx;
  const bestIdx = ranked[ranked.length - 1]?.i ?? 0;
  const best2Idx = ranked.length > 1 ? (ranked[ranked.length - 2]?.i ?? bestIdx) : bestIdx;

  const worstZ = usable[worstIdx] ?? 0;
  const worst2Z = usable[worst2Idx] ?? 0;
  const bestZ = usable[bestIdx] ?? 0;
  const best2Z = usable[best2Idx] ?? 0;
  const worstMetrics = usableDetails[worstIdx]?.metrics ?? [];
  const worst2Metrics = usableDetails[worst2Idx]?.metrics ?? [];
  const bestMetrics = usableDetails[bestIdx]?.metrics ?? [];
  const best2Metrics = usableDetails[best2Idx]?.metrics ?? [];

  const perfMetrics = worstMetrics.filter((m) => !m.isTraffic && m.zScore > 0).sort((a, b) => b.zScore - a.zScore);
  let worstDriver = "Mixed issues";
  if (perfMetrics.length > 0) {
    const top = perfMetrics[0];
    worstDriver = top.zScore >= 2.5 ? `${top.label} critical spike` : top.zScore >= 1.5 ? `${top.label} elevated` : `${top.label} anomaly`;
  } else if (worstZ < 0.75) {
    worstDriver = "Within normal range";
  }

  let hotBuckets = 0, criticalBuckets = 0;
  for (const z of usable) {
    if (z >= 0.75) hotBuckets++;
    if (z >= 2.5) criticalBuckets++;
  }

  let maxRun = 0, currentRun = 0;
  for (const z of usable) {
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
    insights.push({ severity: "good", icon: "✅", text: `All ${usable.length} analyzed buckets within normal operating range — no elevated activity detected.` });
  }

  if (bestZ < 0.5 && worstZ >= 1.0) {
    const bestNote = bestMetrics[0] ? ` — ${bestMetrics[0].label}: ${bestMetrics[0].displayValue}` : "";
    insights.push({ severity: "good", icon: "✨", text: `Best conditions at bucket ${bestIdx + 1} (Z=${bestZ.toFixed(2)})${bestNote}. Use as your SLO performance baseline.` });
  }

  if (worst2Idx !== worstIdx && worst2Z >= 0.75) {
    const commonBad = worstMetrics.filter(m => !m.isTraffic && m.zScore > 0.75).map(m => m.label)
      .filter(lbl => (worst2Metrics.find(m => m.label === lbl)?.zScore ?? 0) > 0.75);
    if (commonBad.length > 0) {
      insights.push({ severity: "warning", icon: "🔁", text: `Consistent signal across both worst windows: ${commonBad.join(", ")} elevated in both bucket ${worstIdx + 1} and bucket ${worst2Idx + 1}.` });
    }
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
  const w2note = worst2Idx !== worstIdx ? ` 2nd worst: bucket ${worst2Idx + 1} (Z=${worst2Z.toFixed(1)}).` : "";
  const b2note = best2Idx !== bestIdx ? ` 2nd best: bucket ${best2Idx + 1} (Z=${best2Z.toFixed(2)}).` : "";
  const summary = `Analyzed ${usable.length} ${bucketLabel} bucket${usable.length !== 1 ? "s" : ""} (last excluded as potentially incomplete). ${spikeSummary.charAt(0).toUpperCase() + spikeSummary.slice(1)}${burstDesc}. Worst: bucket ${worstIdx + 1} (Z=${worstZ.toFixed(1)}, driver: ${worstDriver}).${w2note} Best: bucket ${bestIdx + 1} (Z=${bestZ.toFixed(2)}).${b2note}`;

  // Compute alertPattern
  const trafficMetric = worstMetrics.find(m => m.isTraffic);
  const sessZ = trafficMetric?.zScore ?? 0;
  const nonTrafficSorted = worstMetrics.filter(m => !m.isTraffic && m.zScore > 0).sort((a, b) => b.zScore - a.zScore);
  const errZ = nonTrafficSorted[0]?.zScore ?? 0;
  const perfZ = worstMetrics.filter(m => !m.isTraffic).sort((a, b) => b.zScore - a.zScore)[0]?.zScore ?? 0;
  const alertPattern: HotnessAnalysis["alertPattern"] =
    errZ >= 1.0 && sessZ >= 0.75 ? "load-induced" :
    errZ >= 1.0 && sessZ < 0.5 ? "deployment" :
    perfZ >= 1.0 && errZ < 0.5 ? "infrastructure" :
    "unknown";

  // Compute recommendations
  const recommendations: HotnessAnalysis["recommendations"] = [];
  if (worstZ >= 0.75) {
    recommendations.push({ impact: "high", text: `Investigate ${worstDriver} in bucket ${worstIdx + 1} (Z=${worstZ.toFixed(1)}) — compare traces and logs from the worst window against baseline.` });
  }
  if (bestZ < 0.5 && worstZ >= 1.0) {
    const bestNote = bestMetrics[0] ? ` (${bestMetrics[0].label}: ${bestMetrics[0].displayValue})` : "";
    recommendations.push({ impact: "high", text: `Bucket ${bestIdx + 1}${bestNote} represents your optimal operating conditions — use it as your SLO and capacity planning baseline.` });
  }
  if (burstType === "sustained" || burstType === "chronic") {
    recommendations.push({ impact: "medium", text: `${burstType === "chronic" ? "Chronic" : "Sustained"} pattern (${maxRun} consecutive hot buckets) — configure auto-remediation or alerting to catch this pattern automatically.` });
  }

  // Spike episodes
  const HOT_THRESH = 0.75;
  const episodeList: { startIdx: number; endIdx: number; bucketCount: number }[] = [];
  let inEp = false, epStart = 0;
  for (let i = 0; i < usable.length; i++) {
    if (usable[i] >= HOT_THRESH) {
      if (!inEp) { inEp = true; epStart = i; }
    } else if (inEp) {
      episodeList.push({ startIdx: epStart, endIdx: i - 1, bucketCount: i - epStart });
      inEp = false;
    }
  }
  if (inEp) episodeList.push({ startIdx: epStart, endIdx: usable.length - 1, bucketCount: usable.length - epStart });
  const episodeCount = episodeList.length;
  const longestEpisodeBuckets = episodeList.reduce((m, ep) => Math.max(m, ep.bucketCount), 0);

  // Recovery speed
  const recoveryList = episodeList.map(ep => {
    for (let i = ep.endIdx + 1; i < usable.length; i++) {
      if (usable[i] < 0.3 || usable[i] >= HOT_THRESH) return i - ep.endIdx;
    }
    return usable.length - ep.endIdx;
  });
  const avgRecoveryBuckets = recoveryList.length > 0
    ? Math.round(recoveryList.reduce((s, v) => s + v, 0) / recoveryList.length)
    : 0;

  // Drift trend (linear regression)
  const dn = usable.length;
  const dSumX = (dn * (dn - 1)) / 2;
  const dSumX2 = (dn * (dn - 1) * (2 * dn - 1)) / 6;
  const dSumY = usable.reduce((s, v) => s + v, 0);
  const dSumXY = usable.reduce((s, v, i) => s + i * v, 0);
  const driftSlope = dn > 1 ? (dn * dSumXY - dSumX * dSumY) / (dn * dSumX2 - dSumX * dSumX) : 0;
  const driftLabel: "worsening" | "stable" | "improving" = driftSlope > 0.02 ? "worsening" : driftSlope < -0.02 ? "improving" : "stable";

  return { summary, worstIdx, worstZ, worst2Idx, worst2Z, bestIdx, bestZ, best2Idx, best2Z, hotBuckets, criticalBuckets, maxConsecutiveHot: maxRun, burstType, worstDriver, worstMetrics, worst2Metrics, bestMetrics, best2Metrics, usableCount: usable.length, alertPattern, recommendations, insights, episodeCount, longestEpisodeBuckets, avgRecoveryBuckets, driftSlope, driftLabel };
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

function MiniHotnessChart({ scores, worstIdx, worst2Idx, bestIdx, best2Idx }: { scores: number[]; worstIdx: number; worst2Idx: number; bestIdx: number; best2Idx: number }) {
  if (scores.length < 2) return null;
  const W = 640, maxZ = Math.max(...scores, 1);
  const barW = Math.max(2, W / scores.length - 1);
  const color = (z: number) => z >= 2.5 ? "#FF073A" : z >= 1.5 ? "#FF3D9A" : z >= 0.75 ? "#FFF04D" : "#4589FF";
  const xOf = (i: number) => (i / Math.max(scores.length - 1, 1)) * (W - barW);

  // Build raw label specs
  const rawLabels = [
    { idx: worstIdx,  label: "W1", color: "#FF073A", lineW: 1.5, lineOp: 0.75 },
    ...(worst2Idx !== worstIdx ? [{ idx: worst2Idx, label: "W2", color: "#FF8FAB", lineW: 1, lineOp: 0.65 }] : []),
    ...(bestIdx !== worstIdx   ? [{ idx: bestIdx,   label: "B1", color: "#10B981", lineW: 1.5, lineOp: 0.75 }] : []),
    ...(best2Idx !== bestIdx && best2Idx !== worstIdx ? [{ idx: best2Idx, label: "B2", color: "#6EE7A0", lineW: 1, lineOp: 0.65 }] : []),
  ].map(l => ({ ...l, cx: xOf(l.idx) + barW / 2 }));

  // Greedy row assignment to avoid overlap
  const rowMaxX: number[] = [];
  const labelRow = new Map<string, number>();
  [...rawLabels].sort((a, b) => a.cx - b.cx).forEach(lbl => {
    let r = 0; while (r < rowMaxX.length && lbl.cx - rowMaxX[r] < 20) r++;
    labelRow.set(lbl.label, r); rowMaxX[r] = lbl.cx;
  });
  const labelRowH = 14;
  const linesStartY = rowMaxX.length * labelRowH + 2;
  const H = 72;
  const bH = (z: number) => Math.max(3, (z / maxZ) * H);

  return (
    <svg width={W} height={H + linesStartY} style={{ display: "block", borderRadius: 6, background: "rgba(255,255,255,0.03)" }}>
      {scores.map((z, i) => (
        <rect key={i} x={xOf(i)} y={linesStartY + H - bH(z)} width={barW} height={bH(z)} fill={color(z)} opacity={0.85} rx={1} />
      ))}
      {rawLabels.map(({ label, color: c, lineW, lineOp, cx }) => {
        const row = labelRow.get(label) ?? 0;
        return (
          <g key={label}>
            <line x1={cx} y1={linesStartY} x2={cx} y2={linesStartY + H} stroke={c} strokeWidth={lineW} strokeDasharray="3,2" opacity={lineOp} />
            <rect x={cx - 9} y={row * labelRowH + 1} width={18} height={13} rx={2} fill="rgba(15,20,40,0.88)" />
            <text x={cx} y={row * labelRowH + 11} fontSize={8} fill={c} fontWeight="700" fontFamily="'Segoe UI',system-ui,sans-serif" textAnchor="middle">{label}</text>
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

// ─── Comparison tables ─────────────────────────────────────────────────────

const CELL: React.CSSProperties = { padding: "7px 10px", fontSize: 12, borderTop: "1px solid rgba(255,255,255,0.05)" };
const HDR: React.CSSProperties  = { padding: "6px 10px", background: "rgba(255,255,255,0.04)", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" };

function DiffTable({ worstMetrics, bestMetrics, worstLabel, bestLabel }: { worstMetrics: HeatBucketMetric[]; bestMetrics: HeatBucketMetric[]; worstLabel: string; bestLabel: string }) {
  if (worstMetrics.length === 0 || bestMetrics.length === 0) return null;
  const rows = worstMetrics.map((wm) => {
    const bm = bestMetrics.find((b) => b.label === wm.label);
    return { label: wm.label, worstVal: wm.displayValue, bestVal: bm?.displayValue ?? "—", delta: wm.zScore - (bm?.zScore ?? 0), worstZ: wm.zScore, isTraffic: wm.isTraffic };
  });
  return (
    <div>
      <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 0 }}>
          {["Metric", worstLabel, bestLabel, "Δ Z-score"].map((h) => <div key={h} style={HDR}>{h}</div>)}
          {rows.map((row, i) => {
            const gapColor = !row.isTraffic && row.delta > 1 ? "#FF3D9A" : !row.isTraffic && row.delta > 0.5 ? "#FFF04D" : "rgba(255,255,255,0.6)";
            const wColor = row.isTraffic ? "#4589FF" : row.worstZ >= 1.5 ? "#FF3D9A" : row.worstZ >= 0.75 ? "#FFF04D" : "rgba(255,255,255,0.6)";
            const bt = i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none";
            return (
              <React.Fragment key={i}>
                <div style={{ ...CELL, borderTop: bt, color: "rgba(255,255,255,0.75)" }}>{row.label}</div>
                <div style={{ ...CELL, borderTop: bt, fontWeight: 600, color: wColor }}>{row.worstVal}</div>
                <div style={{ ...CELL, borderTop: bt, color: "#10B981" }}>{row.bestVal}</div>
                <div style={{ ...CELL, borderTop: bt, fontWeight: 700, color: gapColor }}>{row.delta > 0 ? "+" : ""}{row.delta.toFixed(1)}</div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CommonTable({ metrics1, metrics2, label1, label2, title, mode }: {
  metrics1: HeatBucketMetric[]; metrics2: HeatBucketMetric[];
  label1: string; label2: string; title: string; mode: "worst" | "best";
}) {
  if (metrics1.length === 0 || metrics2.length === 0) return null;
  const rows = metrics1.map((m1) => {
    const m2 = metrics2.find(m => m.label === m1.label);
    const z2 = m2?.zScore ?? 0;
    const common = !m1.isTraffic && (mode === "worst" ? (m1.zScore > 0.75 && z2 > 0.75) : (m1.zScore <= 0.75 && z2 <= 0.75));
    return { label: m1.label, val1: m1.displayValue, z1: m1.zScore, val2: m2?.displayValue ?? "—", z2, common, isTraffic: m1.isTraffic };
  });
  const zColor = (z: number, isTraffic: boolean) => isTraffic ? "#4589FF" : z >= 1.5 ? "#FF3D9A" : z >= 0.75 ? "#FFF04D" : "#10B981";
  const signalColor = mode === "worst" ? "#FF3D9A" : "#10B981";
  return (
    <div>
      {title && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>{title}</div>}
      <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 0 }}>
          {["Metric", label1, label2, "Pattern"].map((h) => <div key={h} style={HDR}>{h}</div>)}
          {rows.map((row, i) => {
            const bt = i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none";
            const bg = row.common ? `${signalColor}08` : "transparent";
            return (
              <React.Fragment key={i}>
                <div style={{ ...CELL, borderTop: bt, background: bg, color: "rgba(255,255,255,0.75)", fontWeight: row.common ? 700 : 400 }}>{row.label}</div>
                <div style={{ ...CELL, borderTop: bt, background: bg, fontWeight: 600, color: zColor(row.z1, row.isTraffic ?? false) }}>{row.val1} <span style={{ fontSize: 10, opacity: 0.6 }}>{row.z1 > 0 ? "+" : ""}{row.z1.toFixed(1)}σ</span></div>
                <div style={{ ...CELL, borderTop: bt, background: bg, fontWeight: 600, color: zColor(row.z2, row.isTraffic ?? false) }}>{row.val2} <span style={{ fontSize: 10, opacity: 0.6 }}>{row.z2 > 0 ? "+" : ""}{row.z2.toFixed(1)}σ</span></div>
                <div style={{ ...CELL, borderTop: bt, background: bg, fontWeight: 700, color: row.common ? signalColor : "rgba(255,255,255,0.2)", fontSize: 11 }}>{row.common ? (mode === "worst" ? "Both hot" : "Both healthy") : "—"}</div>
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

// Probes each app by fetching icon.svg and inspecting both Content-Type AND body content.
// Deployed apps serve an SVG file; non-deployed paths return the HTML SPA shell.
// Strategy: check Content-Type first (fast); if that's ambiguous (DT CDN may return text/html
// for all paths), read the first few bytes of the body to see if it's real SVG markup.
// Same-origin fetch (all apps share the tenant domain) — no CORS, no img-src CSP needed.
// Condition: showGitHub only when status === false (confirmed not deployed), never on undefined.
function useAppDeploymentStatuses(appIds: string[]): Record<string, boolean> {
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const key = appIds.join(",");
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let envUrl = "";
    try { envUrl = getEnvironmentUrl(); } catch { /* relative fallback */ }
    const controllers: AbortController[] = [];
    for (const appId of appIds) {
      const controller = new AbortController();
      controllers.push(controller);
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; controller.abort(); }
      }, 6000);
      fetch(`${envUrl}/ui/apps/${appId}/icon.svg`, { signal: controller.signal, cache: "no-store" })
        .then(async (res) => {
          if (cancelled || settled) return;
          settled = true;
          clearTimeout(timer);
          if (!res.ok) { setStatuses(prev => ({ ...prev, [appId]: false })); return; }
          const ct = res.headers.get("content-type") ?? "";
          if (ct.includes("svg") || ct.includes("image")) {
            setStatuses(prev => ({ ...prev, [appId]: true })); return;
          }
          // Content-Type may be wrong (DT CDN quirk) — inspect body to confirm SVG vs HTML
          const text = await res.text();
          const head = text.trimStart().substring(0, 15).toLowerCase();
          setStatuses(prev => ({ ...prev, [appId]: head.startsWith("<svg") || head.startsWith("<?xml") }));
        })
        .catch((err) => {
          if (cancelled || settled) return;
          settled = true;
          clearTimeout(timer);
          if ((err as Error).name === "AbortError") return; // timeout — leave as undefined (assume deployed)
          setStatuses(prev => ({ ...prev, [appId]: false }));
        });
    }
    return () => { cancelled = true; controllers.forEach(c => c.abort()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return statuses;
}

export function HotnessAssistPanel({ heatScores, bucketDetails, bucketLabel, persona: _persona, heatMetrics, problems, intervalMinutes = 5, pos, onDragStart, onClose }: HotnessAssistPanelProps) {
  const analysis = analyzeHotness(heatScores, bucketDetails, bucketLabel);
  const hasTwoWorst = analysis.worst2Idx !== analysis.worstIdx;
  const hasTwoBest  = analysis.best2Idx  !== analysis.bestIdx;

  const handleExportPdf = useCallback(() => {
    const ts = new Date().toLocaleString();

    // Build SVG timeline with greedy staggered labels (same logic as panel chart)
    const pdfScores = heatScores.slice(0, -1);
    const pdfSvg = (() => {
      if (pdfScores.length < 2) return "";
      const W = 640, maxZ = Math.max(...pdfScores, 1);
      const barW = Math.max(2, W / pdfScores.length - 1);
      const colorFn = (z: number) => z >= 2.5 ? "#FF073A" : z >= 1.5 ? "#FF3D9A" : z >= 0.75 ? "#FFF04D" : "#4589FF";
      const xOf = (i: number) => (i / Math.max(pdfScores.length - 1, 1)) * (W - barW);
      const rawLabels = [
        { idx: analysis.worstIdx, label: "W1", color: "#FF073A", lineW: 1.5, lineOp: 0.75 },
        ...(analysis.worst2Idx !== analysis.worstIdx ? [{ idx: analysis.worst2Idx, label: "W2", color: "#FF8FAB", lineW: 1, lineOp: 0.65 }] : []),
        ...(analysis.bestIdx !== analysis.worstIdx ? [{ idx: analysis.bestIdx, label: "B1", color: "#10B981", lineW: 1.5, lineOp: 0.75 }] : []),
        ...(analysis.best2Idx !== analysis.bestIdx && analysis.best2Idx !== analysis.worstIdx ? [{ idx: analysis.best2Idx, label: "B2", color: "#6EE7A0", lineW: 1, lineOp: 0.65 }] : []),
      ].map(l => ({ ...l, cx: xOf(l.idx) + barW / 2 }));
      const rowMaxX: number[] = [];
      const labelRowMap: Record<string, number> = {};
      [...rawLabels].sort((a, b) => a.cx - b.cx).forEach(lbl => {
        let r = 0; while (r < rowMaxX.length && lbl.cx - rowMaxX[r] < 20) r++;
        labelRowMap[lbl.label] = r; rowMaxX[r] = lbl.cx;
      });
      const labelRowH = 14;
      const linesStartY = rowMaxX.length * labelRowH + 2;
      const H = 72;
      const bH = (z: number) => Math.max(3, (z / maxZ) * H);
      const bars = pdfScores.map((z, i) => `<rect x="${xOf(i)}" y="${linesStartY + H - bH(z)}" width="${barW}" height="${bH(z)}" fill="${colorFn(z)}" opacity="0.85" rx="1"/>`).join("");
      const markers = rawLabels.map(({ idx, label, color: c, lineW, lineOp, cx }) => {
        const row = labelRowMap[label] ?? 0;
        return `<line x1="${cx}" y1="${linesStartY}" x2="${cx}" y2="${linesStartY + H}" stroke="${c}" stroke-width="${lineW}" stroke-dasharray="3,2" opacity="${lineOp}"/><rect x="${cx - 9}" y="${row * labelRowH + 1}" width="18" height="13" rx="2" fill="rgba(15,20,40,0.88)"/><text x="${cx}" y="${row * labelRowH + 11}" font-size="8" fill="${c}" font-weight="700" font-family="Segoe UI,system-ui,sans-serif" text-anchor="middle">${label}</text>`;
      }).join("");
      return `<svg width="${W}" height="${H + linesStartY}" style="display:block;border-radius:6px;background:rgba(255,255,255,0.03)">${bars}${markers}</svg>`;
    })();

    // Metric table rows for PDF
    const metricTableRows = (metrics: HeatBucketMetric[]) => metrics.map(m =>
      `<tr><td style="padding:3px 10px;opacity:0.7;font-size:12px">${m.label}</td><td style="padding:3px 10px;font-weight:600;font-size:12px;color:${m.zScore >= 1.5 ? "#FF3D9A" : m.zScore >= 0.75 ? "#FFF04D" : "#10B981"}">${m.displayValue} <span style="font-size:10px;opacity:0.6">${m.zScore > 0 ? "+" : ""}${m.zScore.toFixed(1)}σ</span></td></tr>`
    ).join("");

    // Delta table for W1 vs B1
    const deltaTableRows = analysis.worstMetrics.map(wm => {
      const bm = analysis.bestMetrics.find(b => b.label === wm.label);
      const delta = wm.zScore - (bm?.zScore ?? 0);
      const gapColor = !wm.isTraffic && delta > 1 ? "#FF3D9A" : !wm.isTraffic && delta > 0.5 ? "#FFF04D" : "rgba(255,255,255,0.6)";
      const wColor = wm.isTraffic ? "#4589FF" : wm.zScore >= 1.5 ? "#FF3D9A" : wm.zScore >= 0.75 ? "#FFF04D" : "rgba(255,255,255,0.6)";
      return `<tr><td style="padding:5px 10px;font-size:12px">${wm.label}</td><td style="padding:5px 10px;font-size:12px;font-weight:600;color:#10B981">${bm?.displayValue ?? "—"}</td><td style="padding:5px 10px;font-size:12px;font-weight:600;color:${wColor}">${wm.displayValue}</td><td style="padding:5px 10px;font-size:12px;font-weight:700;color:${gapColor}">${delta > 0 ? "+" : ""}${delta.toFixed(1)}</td></tr>`;
    }).join("");

    // Common table rows (W1vsW2 or B1vsB2)
    const commonTableRows = (m1s: HeatBucketMetric[], m2s: HeatBucketMetric[], mode: "worst" | "best") => m1s.map(m1 => {
      const m2 = m2s.find(m => m.label === m1.label);
      const z2 = m2?.zScore ?? 0;
      const isCommon = !m1.isTraffic && (mode === "worst" ? (m1.zScore > 0.75 && z2 > 0.75) : (m1.zScore <= 0.75 && z2 <= 0.75));
      const zColor = (z: number, isT: boolean) => isT ? "#4589FF" : z >= 1.5 ? "#FF3D9A" : z >= 0.75 ? "#FFF04D" : "#10B981";
      const signalColor = mode === "worst" ? "#FF3D9A" : "#10B981";
      const bg = isCommon ? `${signalColor}18` : "transparent";
      return `<tr style="background:${bg}"><td style="padding:5px 10px;font-size:12px;font-weight:${isCommon ? 700 : 400}">${m1.label}</td><td style="padding:5px 10px;font-size:12px;font-weight:600;color:${zColor(m1.zScore, m1.isTraffic ?? false)}">${m1.displayValue} <span style="font-size:10px;opacity:0.6">${m1.zScore > 0 ? "+" : ""}${m1.zScore.toFixed(1)}σ</span></td><td style="padding:5px 10px;font-size:12px;font-weight:600;color:${zColor(z2, m1.isTraffic ?? false)}">${m2?.displayValue ?? "—"} <span style="font-size:10px;opacity:0.6">${z2 > 0 ? "+" : ""}${z2.toFixed(1)}σ</span></td><td style="padding:5px 10px;font-size:12px;font-weight:700;color:${isCommon ? signalColor : "rgba(255,255,255,0.2)"}">${isCommon ? (mode === "worst" ? "Both hot" : "Both healthy") : "—"}</td></tr>`;
    }).join("");

    // Pattern/burst info
    const patternLabel = analysis.alertPattern === "deployment" ? "Deployment Regression" : analysis.alertPattern === "load-induced" ? "Load-Induced Overload" : analysis.alertPattern === "infrastructure" ? "Infrastructure Issue" : "Pattern Unknown";
    const patternColor = analysis.alertPattern === "deployment" ? "#FF3D9A" : analysis.alertPattern === "load-induced" ? "#FFF04D" : analysis.alertPattern === "infrastructure" ? "#FF832B" : "#888";
    const patternSub = analysis.alertPattern === "deployment" ? "Code / config change most likely" : analysis.alertPattern === "load-induced" ? "Infrastructure capacity limit hit" : analysis.alertPattern === "infrastructure" ? "CDN, network, or origin saturation" : "Insufficient signal for classification";
    const burstColor = analysis.burstType === "chronic" ? "#FF073A" : analysis.burstType === "sustained" ? "#FF3D9A" : analysis.burstType === "transient" ? "#FFF04D" : "#10B981";
    const burstLabel = analysis.burstType === "chronic" ? `Chronic (${analysis.maxConsecutiveHot} consecutive)` : analysis.burstType === "sustained" ? `Sustained (${analysis.maxConsecutiveHot} consecutive)` : analysis.burstType === "transient" ? `Transient (${analysis.maxConsecutiveHot} consecutive)` : "Stable";
    const burstSub = analysis.burstType === "chronic" ? "Needs active remediation" : analysis.burstType === "sustained" ? "Likely needed intervention" : analysis.burstType === "transient" ? "Appears self-resolved" : "No elevated buckets";

    const insHtml = analysis.insights.map(ins =>
      `<div style="margin-bottom:7px;padding:8px 12px;border-radius:6px;border-left:3px solid ${INSIGHT_COLORS[ins.severity]};background:rgba(255,255,255,0.03)"><span style="font-size:11px;font-weight:700;opacity:0.55;margin-right:6px">${ins.severity.toUpperCase()}</span>${ins.icon} ${ins.text}</div>`
    ).join("");

    const recsHtml = analysis.recommendations.length > 0
      ? `<div class="section-label">Recommendations</div>` +
        analysis.recommendations.map(rec => {
          const rc = rec.impact === "high" ? "#FF3D9A" : rec.impact === "medium" ? "#FFF04D" : "#4589FF";
          return `<div style="margin-bottom:7px;padding:8px 12px;border-radius:6px;border-left:3px solid ${rc};background:rgba(255,255,255,0.03)"><span style="font-size:11px;font-weight:700;color:${rc};margin-right:8px;text-transform:uppercase">${rec.impact}</span>${rec.text}</div>`;
        }).join("")
      : "";

    const davisHtml = problems && problems.count > 0
      ? `<div class="page-break"></div><div class="section-label">⚠️ Active Davis Problems · ${problems.count} Open</div>` +
        problems.titles.slice(0, 5).map(t => `<div style="margin-bottom:5px;padding:8px 11px;background:rgba(255,7,58,0.07);border:1px solid rgba(255,7,58,0.25);border-radius:7px;font-size:12px">🔴 ${t}</div>`).join("") +
        (problems.count > 5 ? `<div style="font-size:11px;opacity:0.4;padding:4px 11px">+ ${problems.count - 5} more open problem${problems.count - 5 !== 1 ? "s" : ""}</div>` : "")
      : "";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hotness Assist Report — NavigatorIQ</title>
<style>
  @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } @page { margin: 0.6in; size: A4; } .no-print { display: none !important; } .page-break { page-break-before: always; } }
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e0e0e0;background:#0f1428;margin:0 auto;padding:32px;max-width:900px;line-height:1.5;}
  h1{margin:0 0 4px;font-size:22px;color:#FF8C42;}
  .section-label{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin:20px 0 8px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:5px;}
  .toolbar{text-align:right;margin-bottom:16px;}.toolbar button{background:#FF8C42;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}
  .kpi-tile{background:rgba(128,128,128,0.08);border:1px solid rgba(128,128,128,0.15);border-radius:8px;padding:10px 14px;text-align:center;}
  .card-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;}
  .card{border-radius:8px;padding:12px 14px;}
  .page-break{page-break-before:always;margin-top:20px;}
  table{border-collapse:collapse;width:100%;margin-bottom:20px;}td,th{padding:6px 10px;border-bottom:1px solid rgba(128,128,128,0.08);font-size:13px;}th{text-align:left;font-size:10px;opacity:0.5;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;}
</style></head><body>
<div class="toolbar no-print"><button onclick="window.print()">Print / Save PDF</button></div>
<h1>🔥 Hotness Assist Report — NavigatorIQ</h1>
<div style="font-size:11px;color:#888;margin-bottom:20px">${analysis.usableCount} buckets analyzed · ${analysis.hotBuckets} elevated · ${analysis.criticalBuckets} critical | Generated: ${ts}</div>

<div class="section-label">Summary</div>
<p style="font-size:13px;line-height:1.7;margin-top:0">${analysis.summary}</p>

<div class="kpi-grid">
  <div class="kpi-tile"><div style="font-size:22px;font-weight:800;color:${analysis.hotBuckets > 0 ? "#FFF04D" : "#10B981"}">${analysis.hotBuckets}/${analysis.usableCount}</div><div style="font-size:10px;opacity:0.5;margin-top:4px">Hot Buckets</div></div>
  <div class="kpi-tile"><div style="font-size:22px;font-weight:800;color:${analysis.criticalBuckets > 0 ? "#FF073A" : "#10B981"}">${analysis.criticalBuckets}</div><div style="font-size:10px;opacity:0.5;margin-top:4px">Critical Spikes</div></div>
  <div class="kpi-tile"><div style="font-size:22px;font-weight:800;color:#FF073A">${analysis.worstZ.toFixed(2)}σ</div><div style="font-size:10px;opacity:0.5;margin-top:4px">Worst Z-score</div></div>
  <div class="kpi-tile"><div style="font-size:22px;font-weight:800;color:#10B981">${analysis.bestZ.toFixed(2)}σ</div><div style="font-size:10px;opacity:0.5;margin-top:4px">Best Z-score</div></div>
</div>

<div class="section-label">Hotness Timeline · ${analysis.usableCount} ${bucketLabel} buckets (last excluded)</div>
${pdfSvg}

<div class="card-grid" style="margin-top:16px">
  <div class="card" style="background:${patternColor}12;border:1px solid ${patternColor}40">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:6px">Pattern Analysis</div>
    <div style="font-size:15px;font-weight:700;color:${patternColor}">${patternLabel}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:3px">${patternSub}</div>
  </div>
  <div class="card" style="background:${burstColor}12;border:1px solid ${burstColor}40">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:6px">Spike Duration</div>
    <div style="font-size:15px;font-weight:700;color:${burstColor}">${burstLabel}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:3px">${burstSub}</div>
  </div>
</div>

${analysis.worstMetrics.length > 0 && analysis.bestMetrics.length > 0 ? `
<div class="page-break"></div>
<div class="section-label">What's Different — Worst #1 vs Best #1</div>
<div class="card-grid">
  <div class="card" style="background:rgba(255,7,58,0.06);border:1px solid rgba(255,7,58,0.2)">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#FF073A;margin-bottom:8px">▲ Worst #1 — Bucket ${analysis.worstIdx + 1} (Z=${analysis.worstZ.toFixed(2)})</div>
    <table><tbody>${metricTableRows(analysis.worstMetrics)}</tbody></table>
  </div>
  <div class="card" style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2)">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#10B981;margin-bottom:8px">▽ Best #1 — Bucket ${analysis.bestIdx + 1} (Z=${analysis.bestZ.toFixed(2)})</div>
    <table><tbody>${metricTableRows(analysis.bestMetrics)}</tbody></table>
  </div>
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px">
  <thead><tr>
    <th style="padding:5px 10px;font-size:10px;font-weight:700;opacity:0.5;text-transform:uppercase;border-bottom:1px solid rgba(128,128,128,0.2);text-align:left">Metric</th>
    <th style="padding:5px 10px;font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(128,128,128,0.2);text-align:left;color:#10B981">Best #1</th>
    <th style="padding:5px 10px;font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(128,128,128,0.2);text-align:left;color:#FF073A">Worst #1</th>
    <th style="padding:5px 10px;font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(128,128,128,0.2);text-align:left">Δ Z-score</th>
  </tr></thead>
  <tbody>${deltaTableRows}</tbody>
</table>` : ""}

${hasTwoWorst ? `
<div class="page-break"></div>
<div class="section-label">Common Bad Signals — Worst #1 vs Worst #2</div>
<div class="card-grid">
  <div class="card" style="background:rgba(255,7,58,0.06);border:1px solid rgba(255,7,58,0.2)">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#FF073A;margin-bottom:8px">▲ Worst #1 — Bucket ${analysis.worstIdx + 1} (Z=${analysis.worstZ.toFixed(2)})</div>
    <table><tbody>${metricTableRows(analysis.worstMetrics)}</tbody></table>
  </div>
  <div class="card" style="background:rgba(255,61,154,0.06);border:1px solid rgba(255,61,154,0.2)">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#FF3D9A;margin-bottom:8px">▲ Worst #2 — Bucket ${analysis.worst2Idx + 1} (Z=${analysis.worst2Z.toFixed(2)})</div>
    <table><tbody>${metricTableRows(analysis.worst2Metrics)}</tbody></table>
  </div>
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px">
  <thead><tr>
    <th style="padding:5px 10px;font-size:10px;font-weight:700;opacity:0.5;text-transform:uppercase;border-bottom:1px solid rgba(128,128,128,0.2);text-align:left">Metric</th>
    <th style="padding:5px 10px;font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(128,128,128,0.2);text-align:left;color:#FF073A">Worst #1</th>
    <th style="padding:5px 10px;font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(128,128,128,0.2);text-align:left;color:#FF3D9A">Worst #2</th>
    <th style="padding:5px 10px;font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(128,128,128,0.2);text-align:left">Pattern</th>
  </tr></thead>
  <tbody>${commonTableRows(analysis.worstMetrics, analysis.worst2Metrics, "worst")}</tbody>
</table>` : ""}

${hasTwoBest ? `
<div class="page-break"></div>
<div class="section-label">Common Good Signals — Best #1 vs Best #2</div>
<div class="card-grid">
  <div class="card" style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2)">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#10B981;margin-bottom:8px">▽ Best #1 — Bucket ${analysis.bestIdx + 1} (Z=${analysis.bestZ.toFixed(2)})</div>
    <table><tbody>${metricTableRows(analysis.bestMetrics)}</tbody></table>
  </div>
  <div class="card" style="background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.2)">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#34D399;margin-bottom:8px">▽ Best #2 — Bucket ${analysis.best2Idx + 1} (Z=${analysis.best2Z.toFixed(2)})</div>
    <table><tbody>${metricTableRows(analysis.best2Metrics)}</tbody></table>
  </div>
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px">
  <thead><tr>
    <th style="padding:5px 10px;font-size:10px;font-weight:700;opacity:0.5;text-transform:uppercase;border-bottom:1px solid rgba(128,128,128,0.2);text-align:left">Metric</th>
    <th style="padding:5px 10px;font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(128,128,128,0.2);text-align:left;color:#10B981">Best #1</th>
    <th style="padding:5px 10px;font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(128,128,128,0.2);text-align:left;color:#34D399">Best #2</th>
    <th style="padding:5px 10px;font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(128,128,128,0.2);text-align:left">Pattern</th>
  </tr></thead>
  <tbody>${commonTableRows(analysis.bestMetrics, analysis.best2Metrics, "best")}</tbody>
</table>` : ""}

<div class="page-break"></div>
<div class="section-label">Insights</div>
${insHtml}
${recsHtml}
${davisHtml}
</body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }, [analysis, hasTwoWorst, hasTwoBest, heatScores, bucketLabel, problems]);

  // Per-user "installed apps" list — overrides probe results for reliable hiding of GitHub links
  const installedAppsState = useUserAppState({ key: INSTALLED_APPS_KEY });
  const { execute: saveInstalledApps } = useSetUserAppState();
  const [localInstalled, setLocalInstalled] = useState<string[] | null>(null);
  const installedApps = useMemo(
    () => localInstalled ?? parseInstalledApps(installedAppsState.data?.value as string | undefined),
    [localInstalled, installedAppsState.data?.value],
  );
  const markInstalled = useCallback((appPath: string) => {
    const updated = [...new Set([...installedApps, appPath])];
    saveInstalledApps({ key: INSTALLED_APPS_KEY, body: { value: JSON.stringify(updated) } });
    setLocalInstalled(updated);
  }, [installedApps, saveInstalledApps]);

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

  // Auto-mark as installed when probe confirms an app is deployed
  useEffect(() => {
    for (const [appId, status] of Object.entries(deploymentStatuses)) {
      if (status === true && !installedApps.includes(appId)) {
        markInstalled(appId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentStatuses]);
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onMouseDown={e => e.stopPropagation()} onClick={handleExportPdf} title="Export printable PDF report"
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "rgba(69,137,255,0.1)", border: "1px solid rgba(69,137,255,0.3)", borderRadius: 6, color: "#4589FF", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: "middle" }}><path d="M4 1h5l4 4v9a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 14V2.5A1.5 1.5 0 014 1z" stroke="currentColor" strokeWidth="1.5"/><path d="M9 1v4h4" stroke="currentColor" strokeWidth="1.5"/></svg>
            Export PDF
          </button>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={() => {
              const appName = "NavigatorIQ";
              const rec0 = analysis.recommendations[0]?.text ?? "Investigate root cause.";
              const text = `${appName} detected a ${analysis.alertPattern}-pattern spike — ${analysis.episodeCount} episode${analysis.episodeCount !== 1 ? "s" : ""} (longest ${analysis.longestEpisodeBuckets} bucket${analysis.longestEpisodeBuckets !== 1 ? "s" : ""}, peak Z=${analysis.worstZ.toFixed(1)}). Drift: ${analysis.driftLabel}. Recovery: ${analysis.avgRecoveryBuckets === 0 ? "n/a" : `avg ${analysis.avgRecoveryBuckets} bucket${analysis.avgRecoveryBuckets !== 1 ? "s" : ""}`}. Recommendation: ${rec0}`;
              navigator.clipboard.writeText(text).catch(() => {});
            }}
            title="Copy executive summary to clipboard"
            style={{ background: "rgba(128,128,128,0.12)", border: "1px solid rgba(128,128,128,0.2)", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 10, padding: "3px 8px", borderRadius: 4, fontWeight: 600 }}
          >
            📋
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 24, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>×</button>
        </div>
      </div>

      <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* KPI Tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { label: "Hot Buckets", value: `${analysis.hotBuckets}/${analysis.usableCount}`, color: analysis.hotBuckets > 0 ? "#FFF04D" : "#10B981" },
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
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Hotness Timeline · {analysis.usableCount} {bucketLabel} buckets analyzed (last excluded)</div>
          <MiniHotnessChart scores={heatScores.slice(0, -1)} worstIdx={analysis.worstIdx} worst2Idx={analysis.worst2Idx} bestIdx={analysis.bestIdx} best2Idx={analysis.best2Idx} />
        </div>

        {/* Pattern Analysis + Spike Duration */}
        {(() => {
          const patternColor = analysis.alertPattern === "deployment" ? "#FF3D9A" : analysis.alertPattern === "load-induced" ? "#FFF04D" : analysis.alertPattern === "infrastructure" ? "#FF832B" : "#888";
          const patternLabel = analysis.alertPattern === "deployment" ? "Deployment Regression" : analysis.alertPattern === "load-induced" ? "Load-Induced Overload" : analysis.alertPattern === "infrastructure" ? "Infrastructure Issue" : "Pattern Unknown";
          const patternSubLabel = analysis.alertPattern === "deployment" ? "Code / config change most likely" : analysis.alertPattern === "load-induced" ? "Infrastructure capacity limit hit" : analysis.alertPattern === "infrastructure" ? "CDN, network, or origin saturation" : "Insufficient signal for classification";
          const burstColor = analysis.burstType === "chronic" ? "#FF073A" : analysis.burstType === "sustained" ? "#FF3D9A" : analysis.burstType === "transient" ? "#FFF04D" : "#10B981";
          const burstLabel = analysis.burstType === "chronic" ? `Chronic (${analysis.maxConsecutiveHot} consecutive)` : analysis.burstType === "sustained" ? `Sustained (${analysis.maxConsecutiveHot} consecutive)` : analysis.burstType === "transient" ? `Transient (${analysis.maxConsecutiveHot} consecutive)` : "Stable";
          const burstSubLabel = analysis.burstType === "chronic" ? "Needs active remediation" : analysis.burstType === "sustained" ? "Likely needed intervention" : analysis.burstType === "transient" ? "Appears self-resolved" : "No elevated buckets";
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: `${patternColor}12`, border: `1px solid ${patternColor}40`, borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Pattern Analysis</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: patternColor }}>{patternLabel}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>{patternSubLabel}</div>
              </div>
              <div style={{ background: `${burstColor}12`, border: `1px solid ${burstColor}40`, borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Spike Duration</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: burstColor }}>{burstLabel}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>{burstSubLabel}</div>
              </div>
            </div>
          );
        })()}

        {/* Spike Episodes + Recovery + Drift */}
        {(() => {
          const epColor = analysis.episodeCount === 0 ? "#10B981" : analysis.episodeCount === 1 ? "#FFF04D" : analysis.episodeCount <= 3 ? "#FF3D9A" : "#E00000";
          const recLabel = analysis.episodeCount === 0 ? "N/A" : analysis.avgRecoveryBuckets <= 1 ? "Rapid" : analysis.avgRecoveryBuckets <= 3 ? "Fast" : analysis.avgRecoveryBuckets <= 6 ? "Moderate" : "Slow";
          const recColor = analysis.episodeCount === 0 ? "#888" : analysis.avgRecoveryBuckets <= 1 ? "#10B981" : analysis.avgRecoveryBuckets <= 3 ? "#10B981" : analysis.avgRecoveryBuckets <= 6 ? "#FFF04D" : "#E00000";
          const driftColor = analysis.driftLabel === "worsening" ? "#E00000" : analysis.driftLabel === "improving" ? "#10B981" : "#888";
          const cs: React.CSSProperties = { flex: 1, borderRadius: 8, padding: "9px 11px", display: "flex", flexDirection: "column", gap: 2 };
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div style={{ ...cs, background: `${epColor}0d`, border: `1px solid ${epColor}30` }}>
                <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.5, textTransform: "uppercase" as const, letterSpacing: 0.8 }}>Spike Episodes</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: epColor }}>{analysis.episodeCount}</div>
                <div style={{ fontSize: 10, opacity: 0.6 }}>{analysis.episodeCount === 0 ? "No hot buckets" : `Longest: ${analysis.longestEpisodeBuckets} bucket${analysis.longestEpisodeBuckets !== 1 ? "s" : ""}`}</div>
              </div>
              <div style={{ ...cs, background: `${recColor}0d`, border: `1px solid ${recColor}30` }}>
                <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.5, textTransform: "uppercase" as const, letterSpacing: 0.8 }}>Recovery Speed</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: recColor }}>{recLabel}</div>
                <div style={{ fontSize: 10, opacity: 0.6 }}>{analysis.episodeCount === 0 ? "—" : `Avg ${analysis.avgRecoveryBuckets} bucket${analysis.avgRecoveryBuckets !== 1 ? "s" : ""} to baseline`}</div>
              </div>
              <div style={{ ...cs, background: `${driftColor}0d`, border: `1px solid ${driftColor}30` }}>
                <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.5, textTransform: "uppercase" as const, letterSpacing: 0.8 }}>Drift Trend</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: driftColor }}>{analysis.driftLabel.charAt(0).toUpperCase() + analysis.driftLabel.slice(1)}</div>
                <div style={{ fontSize: 10, opacity: 0.6 }}>{`${analysis.driftSlope >= 0 ? "+" : ""}${analysis.driftSlope.toFixed(3)}Z/bucket`}</div>
              </div>
            </div>
          );
        })()}

        {/* Comparison Group 1: What's Different — Worst #1 vs Best #1 */}
        {analysis.worstMetrics.length > 0 && analysis.bestMetrics.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>What's Different — Worst #1 vs Best #1</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ background: "rgba(255,7,58,0.06)", border: "1px solid rgba(255,7,58,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#FF073A", marginBottom: 10 }}>▲ Worst #1 — Bucket {analysis.worstIdx + 1} (Z={analysis.worstZ.toFixed(2)})</div>
                {analysis.worstMetrics.map((m, i) => <MetricRow key={i} m={m} />)}
              </div>
              <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#10B981", marginBottom: 10 }}>▽ Best #1 — Bucket {analysis.bestIdx + 1} (Z={analysis.bestZ.toFixed(2)})</div>
                {analysis.bestMetrics.map((m, i) => <MetricRow key={i} m={m} />)}
              </div>
            </div>
            <DiffTable
              worstMetrics={analysis.worstMetrics} bestMetrics={analysis.bestMetrics}
              worstLabel={`Worst #1 (B${analysis.worstIdx + 1})`} bestLabel={`Best #1 (B${analysis.bestIdx + 1})`}
            />
          </div>
        )}

        {/* Comparison Group 2: Common Bad Signals — Worst #1 vs Worst #2 */}
        {hasTwoWorst && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Common Bad Signals — Worst #1 vs Worst #2</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ background: "rgba(255,7,58,0.06)", border: "1px solid rgba(255,7,58,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#FF073A", marginBottom: 10 }}>▲ Worst #1 — Bucket {analysis.worstIdx + 1} (Z={analysis.worstZ.toFixed(2)})</div>
                {analysis.worstMetrics.map((m, i) => <MetricRow key={i} m={m} />)}
              </div>
              <div style={{ background: "rgba(255,61,154,0.06)", border: "1px solid rgba(255,61,154,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#FF3D9A", marginBottom: 10 }}>▲ Worst #2 — Bucket {analysis.worst2Idx + 1} (Z={analysis.worst2Z.toFixed(2)})</div>
                {analysis.worst2Metrics.map((m, i) => <MetricRow key={i} m={m} />)}
              </div>
            </div>
            <CommonTable
              metrics1={analysis.worstMetrics} metrics2={analysis.worst2Metrics}
              label1={`Worst #1 (B${analysis.worstIdx + 1})`} label2={`Worst #2 (B${analysis.worst2Idx + 1})`}
              title="" mode="worst"
            />
          </div>
        )}

        {/* Comparison Group 3: Common Good Signals — Best #1 vs Best #2 */}
        {hasTwoBest && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Common Good Signals — Best #1 vs Best #2</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#10B981", marginBottom: 10 }}>▽ Best #1 — Bucket {analysis.bestIdx + 1} (Z={analysis.bestZ.toFixed(2)})</div>
                {analysis.bestMetrics.map((m, i) => <MetricRow key={i} m={m} />)}
              </div>
              <div style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#34D399", marginBottom: 10 }}>▽ Best #2 — Bucket {analysis.best2Idx + 1} (Z={analysis.best2Z.toFixed(2)})</div>
                {analysis.best2Metrics.map((m, i) => <MetricRow key={i} m={m} />)}
              </div>
            </div>
            <CommonTable
              metrics1={analysis.bestMetrics} metrics2={analysis.best2Metrics}
              label1={`Best #1 (B${analysis.bestIdx + 1})`} label2={`Best #2 (B${analysis.best2Idx + 1})`}
              title="" mode="best"
            />
          </div>
        )}

        {/* Insights */}
        {analysis.insights.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Insights</div>
            {analysis.insights.map((ins, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "9px 12px", marginBottom: 6, background: `${INSIGHT_COLORS[ins.severity]}08`, border: `1px solid ${INSIGHT_COLORS[ins.severity]}25`, borderRadius: 8 }}>
                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{ins.icon}</span>
                <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.55 }}>{ins.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Recommendations</div>
            {analysis.recommendations.map((rec, i) => {
              const impactColor = rec.impact === "high" ? "#FF3D9A" : rec.impact === "medium" ? "#FFF04D" : "#4589FF";
              return (
                <div key={i} style={{ display: "flex", gap: 10, padding: "9px 12px", marginBottom: 6, background: `${impactColor}08`, border: `1px solid ${impactColor}25`, borderRadius: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: impactColor, flexShrink: 0, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{rec.impact}</span>
                  <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.55 }}>{rec.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Davis Problems */}
        {problems && problems.count > 0 && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
              ⚠️ Active Davis Problems · {problems.count} Open
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
                  const isInstalled = installedApps.includes(step.appPath);
                  const showGitHub = !!step.repoUrl && !isInstalled;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", background: `${color}08`, border: `1px solid ${color}25`, borderRadius: 8 }}>
                      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{isCrit ? "🔴" : "⚠️"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.82)", lineHeight: 1.5, marginBottom: 6 }}>{step.reason}</div>
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
                          {showGitHub && (
                            <>
                              <a
                                href={step.repoUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: 11, color: "#4589FF", fontWeight: 600, textDecoration: "underline", cursor: "pointer", whiteSpace: "nowrap" }}
                              >
                                ↗ Deploy from GitHub
                              </a>
                              <button
                                onClick={() => markInstalled(step.appPath)}
                                title="Hide this link — app is already installed"
                                style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "3px 7px", cursor: "pointer", whiteSpace: "nowrap" }}
                              >
                                ✓ Already installed
                              </button>
                            </>
                          )}
                        </div>
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
