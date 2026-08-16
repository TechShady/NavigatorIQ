import React, { useState } from "react";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";
import type { Assessment, AssessmentItem, Trend } from "../types";

interface AssessmentPanelProps {
  assessment: Assessment;
  isLoading: boolean;
  onForecast?: (item: AssessmentItem) => void;
}

function TrendArrow({ trend, pct }: { trend?: Trend; pct?: number }) {
  if (!trend || trend === "stable") return <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>— stable</span>;
  const up = trend === "up";
  const color = up ? "#F87171" : "#34D399";
  const arrow = up ? "↑" : "↓";
  return (
    <span style={{ color, fontSize: 11, fontWeight: 600 }}>
      {arrow} {pct !== undefined ? `${Math.abs(pct).toFixed(1)}%` : ""}
    </span>
  );
}

function SeverityDot({ severity }: { severity: "red" | "yellow" | "green" }) {
  const colors = { red: "#EF4444", yellow: "#F59E0B", green: "#10B981" };
  return <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors[severity], flexShrink: 0, boxShadow: `0 0 6px ${colors[severity]}60` }} />;
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

function AssessmentItemRow({ item, onForecast, index }: { item: AssessmentItem; onForecast?: (item: AssessmentItem) => void; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const severityColors = { red: "#EF4444", yellow: "#F59E0B", green: "#10B981" };
  const color = severityColors[item.severity];

  const openApp = (appPath: string) => {
    try {
      window.open(`${getEnvironmentUrl()}/ui/apps/${appPath}`, "_blank");
    } catch {
      window.open(`/ui/apps/${appPath}`, "_blank");
    }
  };

  return (
    <div style={{ borderRadius: 8, border: `1px solid ${color}25`, background: `${color}08`, marginBottom: 6, overflow: "hidden" }}>
      <div
        style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
        onClick={() => setExpanded((v) => !v)}
      >
        <SeverityDot severity={item.severity} />
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#fff" }}>{item.title}</div>
        {item.metricValue !== undefined && (
          <div style={{ fontSize: 12, color, fontWeight: 700, flexShrink: 0 }}>
            {item.metricValue.toFixed(1)}{item.metricUnit ?? ""}
          </div>
        )}
        {item.trend && item.trend !== "stable" && (
          <div style={{ flexShrink: 0 }}>
            <TrendArrow trend={item.trend} pct={item.trendPct} />
          </div>
        )}
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
            {item.builtinAppPath && (
              <AppButton label={item.builtinAppLabel ?? "Open App"} onClick={() => openApp(item.builtinAppPath!)} color="#4589FF" />
            )}
            {item.customApp && (
              <AppButton label={item.customApp.label} onClick={() => openApp(item.customApp!.appPath)} color="#7C3AED" />
            )}
            {onForecast && item.metricValue !== undefined && (
              <AppButton label="Forecast" onClick={() => onForecast(item)} color="#F59E0B" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SeveritySection({ severity, items, label, defaultOpen, onForecast }: { severity: "red" | "yellow" | "green"; items: AssessmentItem[]; label: string; defaultOpen: boolean; onForecast?: (item: AssessmentItem) => void }) {
  const [open, setOpen] = useState(defaultOpen);
  if (items.length === 0) return null;
  const colors = { red: "#EF4444", yellow: "#F59E0B", green: "#10B981" };
  const icons = { red: "🔴", yellow: "🟡", green: "🟢" };
  const color = colors[severity];

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 0", marginBottom: open ? 10 : 0 }}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ fontSize: 16 }}>{icons[severity]}</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color }}>{label}</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 8 }}>({items.length} item{items.length !== 1 ? "s" : ""})</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>{open ? "▲" : "▼"}</div>
      </div>
      {open && items.map((item, i) => (
        <AssessmentItemRow key={i} item={item} onForecast={onForecast} index={i} />
      ))}
    </div>
  );
}

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

export function AssessmentPanel({ assessment, isLoading, onForecast }: AssessmentPanelProps) {
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
        <div style={{ fontSize: 14 }}>No data available for this timeframe. Check that Dynatrace agents are reporting data.</div>
      </div>
    );
  }

  const total = assessment.redItems.length + assessment.yellowItems.length + assessment.greenItems.length;

  return (
    <div>
      {/* IQ Banner */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>NavigatorIQ Assessment</div>
          <HealthBadge health={assessment.overallHealth} />
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#EF4444", lineHeight: 1 }}>{assessment.redItems.length}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Critical</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#F59E0B", lineHeight: 1 }}>{assessment.yellowItems.length}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Warning</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#10B981", lineHeight: 1 }}>{assessment.greenItems.length}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Healthy</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "rgba(255,255,255,0.6)", lineHeight: 1 }}>{total}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Total</div>
          </div>
        </div>
      </div>

      {/* Narrative */}
      {assessment.narrative && (
        <div style={{ background: "rgba(69,137,255,0.05)", border: "1px solid rgba(69,137,255,0.12)", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, fontStyle: "italic" }}>
          {assessment.narrative}
        </div>
      )}

      {/* Severity sections */}
      <SeveritySection severity="red" items={assessment.redItems} label="Needs Immediate Attention" defaultOpen={true} onForecast={onForecast} />
      <SeveritySection severity="yellow" items={assessment.yellowItems} label="Potential Issues" defaultOpen={assessment.redItems.length === 0} onForecast={onForecast} />
      <SeveritySection severity="green" items={assessment.greenItems} label="Environment Healthy" defaultOpen={assessment.redItems.length === 0 && assessment.yellowItems.length === 0} onForecast={onForecast} />
    </div>
  );
}
