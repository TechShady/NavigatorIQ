import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";
import type { Assessment, AssessmentItem, Trend, HeatBucketDetail, PersonaId, HeatMetricConfig } from "../types";
import type { DavisProblemsResult } from "../queries";
import { HotnessAssistButton, HotnessAssistPanel } from "./HotnessAssist";
import { HotnessForecastPanel } from "./HotnessForecastPanel";

interface AssessmentPanelProps {
  assessment: Assessment;
  isLoading: boolean;
  onForecast?: (item: AssessmentItem) => void;
  bucketMs?: number;
  persona?: PersonaId;
  heatMetrics?: HeatMetricConfig[];
  deploymentBuckets?: boolean[] | null;
  davisProblems?: DavisProblemsResult | null;
}

// ─── Drag hook ─────────────────────────────────────────────────────────────

function useDrag(initial: { x: number; y: number }) {
  const [pos, setPos] = useState(initial);
  const posRef = useRef(initial);
  posRef.current = pos;
  const dragging = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = { startX: e.clientX, startY: e.clientY, posX: posRef.current.x, posY: posRef.current.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: dragging.current.posX + ev.clientX - dragging.current.startX, y: dragging.current.posY + ev.clientY - dragging.current.startY });
    };
    const onUp = () => { dragging.current = null; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  return { pos, onDragStart };
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

function TrendArrow({ trend, pct }: { trend?: Trend; pct?: number }) {
  if (!trend || trend === "stable") return <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>— stable</span>;
  const up = trend === "up";
  return (
    <span style={{ color: up ? "#F87171" : "#34D399", fontSize: 11, fontWeight: 600 }}>
      {up ? "↑" : "↓"} {pct !== undefined ? `${Math.abs(pct).toFixed(1)}%` : ""}
    </span>
  );
}

function SeverityDot({ severity }: { severity: "red" | "yellow" | "green" }) {
  const colors = { red: "#EF4444", yellow: "#F59E0B", green: "#10B981" };
  const c = colors[severity];
  return <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0, boxShadow: `0 0 6px ${c}60` }} />;
}

function AppButton({ label, onClick, color = "#4589FF" }: { label: string; onClick: () => void; color?: string }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: hover ? `${color}30` : `${color}18`, border: `1px solid ${color}50`, borderRadius: 5, color, fontSize: 11, fontWeight: 600, padding: "4px 10px", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}
    >
      ↗ {label}
    </button>
  );
}

// ─── Bucket Diagnosis Panel ─────────────────────────────────────────────────

function BucketDiagPanel({
  detail, bucketLabel, pos, onDragStart, onClose, heatMetrics, intervalMinutes,
}: {
  detail: HeatBucketDetail; bucketLabel: string;
  pos: { x: number; y: number };
  onDragStart: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClose: () => void;
  heatMetrics?: HeatMetricConfig[];
  intervalMinutes?: number;
}) {
  const levelColor = (z: number) => z >= 2.5 ? "#FF073A" : z >= 1.5 ? "#FF3D9A" : z >= 0.75 ? "#FFF04D" : "#4589FF";
  const levelLabel = (z: number) => z >= 2.5 ? "Critical Spike" : z >= 1.5 ? "Warm" : z >= 0.75 ? "Elevated" : "Normal";

  // Severity rank: 0=normal, 1=elevated, 2=warm, 3=critical
  const severityRank = (color: string) =>
    color === "#FF073A" ? 3 : color === "#FF3D9A" ? 2 : color === "#FFF04D" ? 1 : 0;

  const thresholdColor = (label: string, value: number): string | null => {
    if (!heatMetrics || !intervalMinutes) return null;
    const cfg = heatMetrics.find((m) => m.label === label);
    if (!cfg) return null;
    const inverted = cfg.warningThreshold !== undefined && cfg.criticalThreshold !== undefined && cfg.warningThreshold > cfg.criticalThreshold;
    if (inverted) {
      // High is good — alert when value falls BELOW threshold (no bucket-time scaling for non-count metrics)
      if (cfg.criticalThreshold != null && value <= cfg.criticalThreshold) return "#FF073A";
      if (cfg.warningThreshold != null && value <= cfg.warningThreshold) return "#FFF04D";
    } else {
      const scale = cfg.thresholdBucketHours ? intervalMinutes / (cfg.thresholdBucketHours * 60) : 1;
      const warn = cfg.warningThreshold != null ? cfg.warningThreshold * scale : null;
      const crit = cfg.criticalThreshold != null ? cfg.criticalThreshold * scale : null;
      if (crit != null && value >= crit) return "#FF073A";
      if (warn != null && value >= warn) return "#FFF04D";
    }
    return null;
  };

  const metricColor = (label: string, value: number, zScore: number, isTraffic?: boolean): string => {
    if (isTraffic) return "#4589FF";
    const zColor = zScore <= 0 ? "#10B981" : levelColor(zScore);
    const tColor = thresholdColor(label, value);
    if (!tColor) return zColor;
    return severityRank(tColor) > severityRank(zColor) ? tColor : zColor;
  };

  const lc = levelColor(detail.zScore);
  const perfMetrics = detail.metrics.filter((m) => !m.isTraffic && m.zScore > 0).sort((a, b) => b.zScore - a.zScore);

  return createPortal(
    <div style={{
      position: "fixed", left: pos.x, top: pos.y, zIndex: 9990, width: 380,
      background: "rgba(14,18,36,0.97)", border: `1px solid ${lc}35`,
      borderRadius: 14, boxShadow: "0 16px 60px rgba(0,0,0,0.75)",
      fontFamily: '"Inter",system-ui,sans-serif', color: "#e8eeff",
      backdropFilter: "blur(14px)",
    }}>
      {/* Drag header */}
      <div onMouseDown={onDragStart} style={{
        cursor: "grab", padding: "11px 16px 10px", userSelect: "none",
        borderBottom: `1px solid ${lc}20`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔎</span>
          <span style={{ fontSize: 14, fontWeight: 800 }}>Bucket {detail.bucketIndex + 1} · Why is this hot?</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 20, cursor: "pointer", padding: "0 3px", lineHeight: 1 }}>×</button>
      </div>

      {/* Z-score summary */}
      <div style={{ padding: "12px 16px 10px", borderBottom: `1px solid rgba(255,255,255,0.05)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 900, color: lc, lineHeight: 1 }}>Z={detail.zScore.toFixed(2)}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: lc, marginTop: 2 }}>{levelLabel(detail.zScore)}</div>
          {perfMetrics.length > 0 && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 5 }}>
              Primary driver: <span style={{ fontWeight: 700, color: lc }}>{perfMetrics[0].label}</span> (+{perfMetrics[0].zScore.toFixed(1)}σ)
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
          {bucketLabel} bucket<br />#{detail.bucketIndex + 1}
        </div>
      </div>

      {/* Metric rows */}
      <div style={{ padding: "12px 16px 16px" }}>
        {detail.metrics.length === 0 && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "12px 0" }}>
            No per-metric breakdown available for this persona.
          </div>
        )}
        {detail.metrics.map((m, i) => {
          const barColor = metricColor(m.label, m.value, m.zScore, m.isTraffic);
          const barW = Math.min(100, Math.abs(m.zScore) / 3 * 100);
          return (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{m.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{m.displayValue}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${barW}%`, height: "100%", background: barColor, borderRadius: 2, transition: "width 0.3s" }} />
                </div>
                <span style={{ fontSize: 11, color: barColor, width: 42, textAlign: "right", fontWeight: 600 }}>
                  {m.zScore > 0 ? "+" : ""}{m.zScore.toFixed(1)}σ
                </span>
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                {m.isTraffic ? "traffic volume vs avg" : m.zScore > 0 ? "↑ higher than avg — investigate" : "✓ within normal range"}
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

// ─── Clickable Heat Strip ─────────────────────────────────────────────────

function ClickableHeatStrip({
  scores, bucketLabel, selectedBucket, onSelectBucket, onAssist, onForecast, deploymentBuckets,
}: {
  scores: number[]; bucketLabel: string; selectedBucket: number | null;
  onSelectBucket: (i: number | null) => void;
  onAssist: () => void;
  onForecast: () => void;
  persona?: PersonaId;
  deploymentBuckets?: boolean[] | null;
}) {
  if (scores.length < 2) return null;
  const maxZ = Math.max(...scores, 1);
  const barColor = (z: number) => z >= 2.5 ? "#FF073A" : z >= 1.5 ? "#FF3D9A" : z >= 0.75 ? "#FFF04D" : "#4589FF";

  const [forecastHover, setForecastHover] = useState(false);
  const hasDeployments = deploymentBuckets && deploymentBuckets.some(Boolean);

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
            Activity Heat · {bucketLabel} buckets
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>({scores.length} intervals · click to diagnose)</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <HotnessAssistButton onClick={onAssist} />
          <button
            onClick={onForecast}
            onMouseEnter={() => setForecastHover(true)}
            onMouseLeave={() => setForecastHover(false)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: forecastHover ? "rgba(69,137,255,0.28)" : "rgba(69,137,255,0.15)",
              border: "1px solid rgba(69,137,255,0.5)", borderRadius: 6,
              color: "#7ab4ff", fontSize: 11, fontWeight: 700, padding: "4px 10px",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            📈 Forecast
          </button>
        </div>
      </div>

      {/* Bars */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 1.5, height: 180, background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "4px 4px", cursor: "pointer" }}>
        {scores.map((z, i) => {
          const sel = selectedBucket === i;
          const hasDeploy = deploymentBuckets?.[i] === true;
          return (
            <div
              key={i}
              style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", position: "relative" }}
            >
              {hasDeploy && (
                <div
                  title="Deployment"
                  style={{ position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)", width: 5, height: 5, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 5px #10B98190", zIndex: 1 }}
                />
              )}
              <div
                title={`Bucket ${i + 1}: Z=${z.toFixed(2)}${hasDeploy ? " · deployment" : ""} — click to diagnose`}
                onClick={() => onSelectBucket(sel ? null : i)}
                style={{
                  width: "100%", height: `${Math.max(10, (z / maxZ) * 100)}%`,
                  background: barColor(z), borderRadius: 2,
                  opacity: selectedBucket === null ? 0.85 : sel ? 1 : 0.35,
                  transition: "all 0.2s",
                  boxShadow: sel ? `0 0 10px ${barColor(z)}80` : "none",
                  outline: sel ? `2px solid ${barColor(z)}` : "none",
                  outlineOffset: 1,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>← start</span>
        <div style={{ display: "flex", gap: 10 }}>
          {[{ z: 0, label: "Normal", color: "#4589FF" }, { z: 0.75, label: "Elevated", color: "#FFF04D" }, { z: 1.5, label: "Warm", color: "#FF3D9A" }, { z: 2.5, label: "Spike", color: "#FF073A" }].map((l) => (
            <span key={l.z} style={{ fontSize: 9, color: l.color }}>● {l.label}</span>
          ))}
          {hasDeployments && <span style={{ fontSize: 9, color: "#10B981" }}>● Deployment</span>}
        </div>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>now →</span>
      </div>
    </div>
  );
}

// ─── Typewriter narrative ─────────────────────────────────────────────────

function TypewriterNarrative({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const lastText = useRef("");

  useEffect(() => { if (lastText.current !== text) { lastText.current = text; setDisplayed(""); } }, [text]);
  useEffect(() => {
    if (displayed.length >= text.length) return;
    const id = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 4)), 18);
    return () => clearTimeout(id);
  }, [displayed, text]);

  const done = displayed.length >= text.length;
  return (
    <div style={{ background: "linear-gradient(135deg, rgba(69,137,255,0.07) 0%, rgba(124,58,237,0.04) 100%)", border: "1px solid rgba(69,137,255,0.2)", borderLeft: "3px solid #4589FF", borderRadius: "0 10px 10px 0", padding: "14px 18px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: "#7ab4ff", animation: done ? "none" : "iq-ai-star 2s ease-in-out infinite" }}>✦</span>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7ab4ff" }}>NavigatorIQ Launcher Intelligence</span>
        {!done && (
          <span style={{ display: "flex", gap: 3, alignItems: "center", marginLeft: 4 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: "#4589FF", animation: `iq-dot 1.4s ease-in-out ${i * 0.16}s infinite` }} />
            ))}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 1.78 }}>
        {displayed}
        {!done && <span style={{ color: "#7ab4ff", animation: "iq-blink 0.8s step-end infinite", fontWeight: 100 }}>|</span>}
      </div>
      <style>{`
        @keyframes iq-ai-star { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.85)} }
        @keyframes iq-dot { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
        @keyframes iq-blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
}

// ─── Assessment item row ──────────────────────────────────────────────────

function AssessmentItemRow({ item, onForecast, index }: { item: AssessmentItem; onForecast?: (item: AssessmentItem) => void; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const colors = { red: "#EF4444", yellow: "#F59E0B", green: "#10B981" };
  const color = colors[item.severity];

  const openApp = (appPath: string) => {
    try { window.open(`${getEnvironmentUrl()}/ui/apps/${appPath}`, "_blank"); }
    catch { window.open(`/ui/apps/${appPath}`, "_blank"); }
  };

  return (
    <div style={{ borderRadius: 8, border: `1px solid ${color}25`, background: `${color}08`, marginBottom: 6, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }} onClick={() => setExpanded((v) => !v)}>
        <SeverityDot severity={item.severity} />
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#fff" }}>{item.title}</div>
        {item.metricValue !== undefined && (
          <div style={{ fontSize: 12, color, fontWeight: 700, flexShrink: 0 }}>{item.metricValue.toFixed(1)}{item.metricUnit ?? ""}</div>
        )}
        {item.trend && item.trend !== "stable" && <div style={{ flexShrink: 0 }}><TrendArrow trend={item.trend} pct={item.trendPct} /></div>}
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginLeft: 4 }}>{expanded ? "▲" : "▼"}</div>
      </div>
      {expanded && (
        <div style={{ padding: "0 14px 12px", borderTop: `1px solid ${color}20` }}>
          <p style={{ margin: "10px 0 8px", fontSize: 12.5, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>{item.detail}</p>
          {item.recommendation && (
            <div style={{ background: "rgba(69,137,255,0.06)", border: "1px solid rgba(69,137,255,0.15)", borderRadius: 6, padding: "8px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(69,137,255,0.8)", marginBottom: 3 }}>Recommendation</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{item.recommendation}</div>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {item.builtinAppPath && <AppButton label={item.builtinAppLabel ?? "Open App"} onClick={() => openApp(item.builtinAppPath!)} color="#4589FF" />}
            {item.customApp && <AppButton label={item.customApp.label} onClick={() => openApp(item.customApp!.appPath)} color="#7C3AED" />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Severity section ─────────────────────────────────────────────────────

function SeveritySection({ severity, items, label, defaultOpen, onForecast }: { severity: "red" | "yellow" | "green"; items: AssessmentItem[]; label: string; defaultOpen: boolean; onForecast?: (item: AssessmentItem) => void }) {
  const [open, setOpen] = useState(defaultOpen);
  if (items.length === 0) return null;
  const colors = { red: "#EF4444", yellow: "#F59E0B", green: "#10B981" };
  const icons = { red: "🔴", yellow: "🟡", green: "🟢" };
  const color = colors[severity];
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 0", marginBottom: open ? 10 : 0 }} onClick={() => setOpen((v) => !v)}>
        <span style={{ fontSize: 16 }}>{icons[severity]}</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color }}>{label}</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 8 }}>({items.length} item{items.length !== 1 ? "s" : ""})</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>{open ? "▲" : "▼"}</div>
      </div>
      {open && items.map((item, i) => <AssessmentItemRow key={i} item={item} onForecast={onForecast} index={i} />)}
    </div>
  );
}

// ─── Health badge ─────────────────────────────────────────────────────────

function HealthBadge({ health }: { health: "red" | "yellow" | "green" }) {
  const map = {
    red: { label: "Critical", color: "#EF4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" },
    yellow: { label: "Warning", color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
    green: { label: "Healthy", color: "#10B981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)" },
  };
  const m = map[health];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: m.bg, border: `1px solid ${m.border}`, borderRadius: 20, padding: "4px 12px" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.label}</span>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────

export function AssessmentPanel({ assessment, isLoading, onForecast, bucketMs = 60000, persona, heatMetrics, deploymentBuckets, davisProblems }: AssessmentPanelProps) {
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);
  const [forecastOpen, setForecastOpen] = useState(false);

  const diagDrag = useDrag({ x: 30, y: 120 });
  const assistDrag = useDrag({ x: 50, y: 90 });
  const forecastDrag = useDrag({ x: 20, y: 160 });

  const handleSelectBucket = useCallback((i: number | null) => {
    if (i === null) {
      setSelectedBucket(null);
      setDiagOpen(false);
    } else {
      setSelectedBucket(i);
      setDiagOpen(true);
    }
  }, []);

  const getRequeryData = useCallback(async (_days: number): Promise<number[]> => assessment.heatScores, [assessment.heatScores]);

  if (isLoading) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 12, animation: "iq-spin 1.5s linear infinite", display: "inline-block" }}>⟳</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>Running assessment queries…</div>
        <style>{`@keyframes iq-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!assessment.dataAvailable) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
        <div style={{ fontSize: 14 }}>No data available for this timeframe.</div>
      </div>
    );
  }

  const total = assessment.redItems.length + assessment.yellowItems.length + assessment.greenItems.length;
  const hasHeat = assessment.heatScores.length > 1;
  const selectedDetail: HeatBucketDetail | null =
    selectedBucket !== null && assessment.bucketDetails[selectedBucket]
      ? assessment.bucketDetails[selectedBucket]
      : null;

  return (
    <div>
      {/* IQ Banner */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>NavigatorIQ Launcher Assessment</div>
          <HealthBadge health={assessment.overallHealth} />
        </div>
        <div
          style={{ display: "flex", gap: 16, cursor: "help" }}
          title="Assessment item counts — not hotness scores. Expand the sections below (Needs Immediate Attention, Potential Issues, Environment Healthy) to see per-metric details."
        >
          {[{ v: assessment.redItems.length, label: "Critical", color: "#EF4444" }, { v: assessment.yellowItems.length, label: "Warning", color: "#F59E0B" }, { v: assessment.greenItems.length, label: "Healthy", color: "#10B981" }, { v: total, label: "Total", color: "rgba(255,255,255,0.6)" }].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Clickable heat strip */}
      {hasHeat && (
        <ClickableHeatStrip
          scores={assessment.heatScores}
          bucketLabel={assessment.bucketLabel}
          selectedBucket={selectedBucket}
          onSelectBucket={handleSelectBucket}
          onAssist={() => setAssistOpen(true)}
          onForecast={() => setForecastOpen(true)}
          deploymentBuckets={deploymentBuckets}
        />
      )}

      {/* Narrative */}
      {assessment.narrative && <TypewriterNarrative text={assessment.narrative} />}

      {/* Severity sections */}
      <SeveritySection severity="red" items={assessment.redItems} label="Needs Immediate Attention" defaultOpen={true} onForecast={onForecast} />
      <SeveritySection severity="yellow" items={assessment.yellowItems} label="Potential Issues" defaultOpen={assessment.redItems.length === 0} onForecast={onForecast} />
      <SeveritySection severity="green" items={assessment.greenItems} label="Environment Healthy" defaultOpen={assessment.redItems.length === 0 && assessment.yellowItems.length === 0} onForecast={onForecast} />

      {/* Bucket diagnosis panel */}
      {diagOpen && selectedDetail && (
        <BucketDiagPanel
          detail={selectedDetail}
          bucketLabel={assessment.bucketLabel}
          pos={diagDrag.pos}
          onDragStart={diagDrag.onDragStart}
          onClose={() => { setDiagOpen(false); setSelectedBucket(null); }}
          heatMetrics={heatMetrics}
          intervalMinutes={Math.round(bucketMs / 60000)}
        />
      )}

      {/* Hotness Assist panel */}
      {assistOpen && (
        <HotnessAssistPanel
          heatScores={assessment.heatScores}
          bucketDetails={assessment.bucketDetails}
          bucketLabel={assessment.bucketLabel}
          persona={persona}
          heatMetrics={heatMetrics}
          problems={davisProblems}
          intervalMinutes={Math.round(bucketMs / 60000)}
          pos={assistDrag.pos}
          onDragStart={assistDrag.onDragStart}
          onClose={() => setAssistOpen(false)}
        />
      )}

      {/* Forecast panel */}
      {forecastOpen && (
        <HotnessForecastPanel
          hotness={assessment.heatScores}
          bucketMs={bucketMs}
          pos={forecastDrag.pos}
          onDragStart={forecastDrag.onDragStart}
          onClose={() => setForecastOpen(false)}
          getRequeryData={getRequeryData}
        />
      )}
    </div>
  );
}
