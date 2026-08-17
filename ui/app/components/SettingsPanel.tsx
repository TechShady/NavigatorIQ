import React, { useState, useCallback, useRef, useEffect } from "react";
import type { PersonaId, AppLink, ThresholdConfig, SavedSettings, HeatMetricConfig, MetricDisplayUnit } from "../types";
import { PERSONAS, DEFAULT_APP_LINKS, DEFAULT_THRESHOLDS, DEFAULT_HEAT_METRICS, APP_VERSION } from "../constants";

interface SettingsPanelProps {
  settings: SavedSettings;
  onSave: (settings: SavedSettings) => void;
  onClose: () => void;
}

type SettingsTab = "applinks" | "thresholds" | "hotness" | "general";

const INPUT_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  color: "#fff",
  fontSize: 12,
  padding: "5px 8px",
  outline: "none",
  width: "100%",
};
const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.45)",
  marginBottom: 3,
  display: "block",
};

function ThresholdRow({ label, field, value, onChange, unit = "", min = 0, step = 0.1 }: { label: string; field: keyof ThresholdConfig; value: number; onChange: (field: keyof ThresholdConfig, val: number) => void; unit?: string; min?: number; step?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 24px", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{label}</div>
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(field, Number(e.target.value))}
        style={{ ...INPUT_STYLE, width: "100%" }}
      />
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{unit}</div>
    </div>
  );
}

function AppLinkRow({ link, index, onChange, onRemove }: { link: AppLink; index: number; onChange: (i: number, link: AppLink) => void; onRemove: (i: number) => void }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: link.enabled ? "#0D9C29" : "rgba(128,128,128,0.4)", cursor: "pointer", flexShrink: 0, transition: "background 0.15s" }} onClick={() => onChange(index, { ...link, enabled: !link.enabled })} title={link.enabled ? "Click to disable" : "Click to enable"} />
          <input value={link.label} onChange={(e) => onChange(index, { ...link, label: e.target.value })} placeholder="App Label" style={{ ...INPUT_STYLE, fontWeight: 600, fontSize: 13 }} />
        </div>
        <button onClick={() => onRemove(index)} style={{ background: "rgba(194,25,48,0.15)", border: "1px solid rgba(194,25,48,0.3)", color: "#ff6b7a", borderRadius: 4, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>Remove</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={LABEL_STYLE}>App Path (e.g. dynatrace.classic.services)</label>
          <input value={link.appPath} onChange={(e) => onChange(index, { ...link, appPath: e.target.value })} placeholder="app.path.here" style={INPUT_STYLE} />
        </div>
        <div>
          <label style={LABEL_STYLE}>Docs URL</label>
          <input value={link.docsUrl} onChange={(e) => onChange(index, { ...link, docsUrl: e.target.value })} placeholder="https://docs.dynatrace.com/..." style={INPUT_STYLE} />
        </div>
      </div>
    </div>
  );
}

const AGG_OPTIONS: { value: "avg" | "sum"; label: string }[] = [
  { value: "avg", label: "avg" },
  { value: "sum", label: "sum" },
];

const UNIT_OPTIONS: { value: MetricDisplayUnit; label: string }[] = [
  { value: "raw", label: "Raw value" },
  { value: "ns->ms", label: "Nanoseconds → ms" },
  { value: "µs->ms", label: "Microseconds → ms" },
  { value: "pct", label: "Percent (%)" },
  { value: "count", label: "Count / Integer" },
];

function CustomSelect<T extends string | number>({ value, onChange, options }: {
  value: T;
  onChange: (val: T) => void;
  options: { value: T; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const selected = options.find((o) => o.value === value);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ ...INPUT_STYLE, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected?.label ?? String(value)}</span>
        <span style={{ fontSize: 9, opacity: 0.55, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#0f1422", border: "1px solid rgba(69,137,255,0.25)", borderRadius: 8, padding: 4, zIndex: 10000, boxShadow: "0 8px 32px rgba(0,0,0,0.7)", minWidth: "100%" }}>
          {options.map((o) => (
            <button
              key={String(o.value)}
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ display: "block", width: "100%", padding: "7px 10px", background: o.value === value ? "rgba(69,137,255,0.15)" : "transparent", border: "none", borderRadius: 6, color: o.value === value ? "#7ab4ff" : "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: o.value === value ? 600 : 400, cursor: "pointer", textAlign: "left" }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HeatMetricRow({ metric, index, onChange, onRemove }: { metric: HeatMetricConfig; index: number; onChange: (i: number, m: HeatMetricConfig) => void; onRemove: (i: number) => void }) {
  return (
    <div style={{ background: "rgba(255,120,30,0.04)", borderRadius: 8, border: "1px solid rgba(255,120,30,0.15)", padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            title={metric.isTraffic ? "Traffic (neutral)" : "Performance metric"}
            onClick={() => onChange(index, { ...metric, isTraffic: !metric.isTraffic })}
            style={{ width: 10, height: 10, borderRadius: 2, background: metric.isTraffic ? "#4589FF" : "#FF8C42", cursor: "pointer", flexShrink: 0 }}
          />
          <input
            value={metric.label}
            onChange={(e) => onChange(index, { ...metric, label: e.target.value })}
            placeholder="Metric Label"
            style={{ ...INPUT_STYLE, fontWeight: 600, fontSize: 13 }}
          />
        </div>
        <button onClick={() => onRemove(index)} style={{ background: "rgba(194,25,48,0.15)", border: "1px solid rgba(194,25,48,0.3)", color: "#ff6b7a", borderRadius: 4, padding: "3px 8px", fontSize: 11, cursor: "pointer", marginLeft: 8 }}>Remove</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 140px", gap: 8 }}>
        <div>
          <label style={LABEL_STYLE}>Grail Metric Key</label>
          <input
            value={metric.metricKey}
            onChange={(e) => onChange(index, { ...metric, metricKey: e.target.value })}
            placeholder="dt.service.request.response_time"
            style={INPUT_STYLE}
          />
        </div>
        <div>
          <label style={LABEL_STYLE}>Aggregation</label>
          <CustomSelect<"avg" | "sum">
            value={metric.aggregation}
            onChange={(val) => onChange(index, { ...metric, aggregation: val })}
            options={AGG_OPTIONS}
          />
        </div>
        <div>
          <label style={LABEL_STYLE}>Display Unit</label>
          <CustomSelect<string>
            value={metric.displayUnit ?? "raw"}
            onChange={(val) => onChange(index, { ...metric, displayUnit: val as MetricDisplayUnit })}
            options={UNIT_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
}

export function SettingsPanel({ settings, onSave, onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("applinks");
  const [activePersona, setActivePersona] = useState<PersonaId>(PERSONAS[0].id);
  const [draft, setDraft] = useState<SavedSettings>(() => JSON.parse(JSON.stringify(settings)));
  const [hasChanges, setHasChanges] = useState(false);

  const markDirty = useCallback(() => setHasChanges(true), []);

  const getPersonaLinks = (personaId: PersonaId): AppLink[] =>
    draft.personas[personaId]?.appLinks ?? DEFAULT_APP_LINKS[personaId] ?? [];

  const getPersonaThresholds = (personaId: PersonaId): ThresholdConfig =>
    ({ ...DEFAULT_THRESHOLDS, ...draft.personas[personaId]?.thresholds });

  const updatePersonaLinks = (personaId: PersonaId, links: AppLink[]) => {
    setDraft((prev) => ({
      ...prev,
      personas: {
        ...prev.personas,
        [personaId]: { ...prev.personas[personaId], appLinks: links },
      },
    }));
    markDirty();
  };

  const updateThreshold = (personaId: PersonaId, field: keyof ThresholdConfig, val: number) => {
    setDraft((prev) => ({
      ...prev,
      personas: {
        ...prev.personas,
        [personaId]: {
          ...prev.personas[personaId],
          thresholds: { ...prev.personas[personaId]?.thresholds, [field]: val },
        },
      },
    }));
    markDirty();
  };

  const addLink = (personaId: PersonaId) => {
    const links = [...getPersonaLinks(personaId), { label: "New App", appPath: "", docsUrl: "", enabled: true }];
    updatePersonaLinks(personaId, links);
  };

  const resetPersonaLinks = (personaId: PersonaId) => {
    updatePersonaLinks(personaId, [...DEFAULT_APP_LINKS[personaId]]);
  };

  const resetPersonaThresholds = (personaId: PersonaId) => {
    setDraft((prev) => ({
      ...prev,
      personas: { ...prev.personas, [personaId]: { ...prev.personas[personaId], thresholds: {} } },
    }));
    markDirty();
  };

  const getPersonaHeatMetrics = (personaId: PersonaId): HeatMetricConfig[] =>
    draft.personas[personaId]?.heatMetrics ?? DEFAULT_HEAT_METRICS[personaId] ?? [];

  const updatePersonaHeatMetrics = (personaId: PersonaId, metrics: HeatMetricConfig[]) => {
    setDraft((prev) => ({
      ...prev,
      personas: {
        ...prev.personas,
        [personaId]: { ...prev.personas[personaId], heatMetrics: metrics },
      },
    }));
    markDirty();
  };

  const addHeatMetric = (personaId: PersonaId) => {
    const metrics = [...getPersonaHeatMetrics(personaId), { label: "New Metric", metricKey: "", aggregation: "avg" as const, displayUnit: "raw" as MetricDisplayUnit }];
    updatePersonaHeatMetrics(personaId, metrics);
  };

  const resetPersonaHeatMetrics = (personaId: PersonaId) => {
    updatePersonaHeatMetrics(personaId, [...(DEFAULT_HEAT_METRICS[personaId] ?? [])]);
  };

  const handleSave = () => {
    onSave(draft);
    setHasChanges(false);
    onClose();
  };

  const tabStyle = (tab: SettingsTab): React.CSSProperties => ({
    padding: "8px 16px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: activeTab === tab ? 700 : 400,
    color: activeTab === tab ? "#fff" : "rgba(255,255,255,0.55)",
    background: activeTab === tab ? "rgba(69,137,255,0.2)" : "transparent",
    border: `1px solid ${activeTab === tab ? "rgba(69,137,255,0.5)" : "transparent"}`,
    transition: "all 0.15s",
  });

  const personaTabStyle = (id: PersonaId): React.CSSProperties => ({
    padding: "6px 10px",
    borderRadius: 5,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: activePersona === id ? 600 : 400,
    color: activePersona === id ? "#fff" : "rgba(255,255,255,0.5)",
    background: activePersona === id ? "rgba(69,137,255,0.15)" : "transparent",
    border: "none",
    textAlign: "left",
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 6,
  });

  const links = getPersonaLinks(activePersona);
  const thresholds = getPersonaThresholds(activePersona);
  const activePersonaDef = PERSONAS.find((p) => p.id === activePersona)!;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99997, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#0f1422", border: "1px solid rgba(69,137,255,0.25)", borderRadius: 14, width: "100%", maxWidth: 860, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.8)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>⚙️ NavigatorIQ Settings</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Customize app links, alert thresholds, and general preferences</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {hasChanges && (
              <button onClick={handleSave} style={{ background: "linear-gradient(135deg,#4589FF 0%,#1e5de0 100%)", border: "1px solid #4589FF", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, padding: "8px 20px", cursor: "pointer" }}>
                Save Changes
              </button>
            )}
            <button onClick={onClose} style={{ background: "rgba(128,128,128,0.15)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, color: "rgba(255,255,255,0.7)", fontSize: 13, padding: "8px 16px", cursor: "pointer" }}>
              {hasChanges ? "Discard" : "Close"}
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ padding: "12px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, flexShrink: 0 }}>
          <button style={tabStyle("applinks")} onClick={() => setActiveTab("applinks")}>🔗 App Links</button>
          <button style={tabStyle("thresholds")} onClick={() => setActiveTab("thresholds")}>🎯 Thresholds</button>
          <button style={tabStyle("hotness")} onClick={() => setActiveTab("hotness")}>🔥 Hotness</button>
          <button style={tabStyle("general")} onClick={() => setActiveTab("general")}>⚙️ General</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {activeTab !== "general" && (
            <div style={{ width: 160, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, overflowY: "auto" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", padding: "4px 10px", marginBottom: 4 }}>Persona</div>
              {PERSONAS.map((p) => (
                <button key={p.id} style={personaTabStyle(p.id)} onClick={() => setActivePersona(p.id)}>
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {activeTab === "applinks" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>{activePersonaDef.icon} {activePersonaDef.label} — App Links</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>These links appear in the NavigatorIQ App Links panel. Toggle the green dot to show/hide each app.</p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => resetPersonaLinks(activePersona)} style={{ background: "rgba(128,128,128,0.1)", border: "1px solid rgba(128,128,128,0.2)", borderRadius: 6, color: "rgba(255,255,255,0.6)", fontSize: 12, padding: "5px 12px", cursor: "pointer" }}>Reset to defaults</button>
                    <button onClick={() => addLink(activePersona)} style={{ background: "rgba(69,137,255,0.1)", border: "1px solid rgba(69,137,255,0.3)", borderRadius: 6, color: "#7ab4ff", fontSize: 12, padding: "5px 12px", cursor: "pointer" }}>+ Add App</button>
                  </div>
                </div>
                {links.map((link, i) => (
                  <AppLinkRow
                    key={i}
                    link={link}
                    index={i}
                    onChange={(idx, updated) => { const next = [...links]; next[idx] = updated; updatePersonaLinks(activePersona, next); }}
                    onRemove={(idx) => { const next = links.filter((_, j) => j !== idx); updatePersonaLinks(activePersona, next); }}
                  />
                ))}
                {links.length === 0 && (
                  <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
                    No app links configured. Click "+ Add App" to add one.
                  </div>
                )}
                <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(69,137,255,0.06)", borderRadius: 8, border: "1px solid rgba(69,137,255,0.15)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(69,137,255,0.9)", marginBottom: 6 }}>How App Paths Work</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                    App paths are Dynatrace app IDs. For built-in apps use e.g. <code style={{ color: "#7ab4ff" }}>dynatrace.classic.services</code>.<br />
                    For your custom apps use their app.config.json ID, e.g. <code style={{ color: "#7ab4ff" }}>my.services.overview.app</code>.<br />
                    Tenant URL is automatically prepended at runtime.
                  </div>
                </div>
              </div>
            )}

            {activeTab === "thresholds" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>{activePersonaDef.icon} {activePersonaDef.label} — Alert Thresholds</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Values that determine Red (critical) and Yellow (warning) classifications in the assessment.</p>
                  </div>
                  <button onClick={() => resetPersonaThresholds(activePersona)} style={{ background: "rgba(128,128,128,0.1)", border: "1px solid rgba(128,128,128,0.2)", borderRadius: 6, color: "rgba(255,255,255,0.6)", fontSize: 12, padding: "5px 12px", cursor: "pointer" }}>Reset to defaults</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", padding: "8px 0 4px", marginBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Services</div>
                  <ThresholdRow label="Error Rate — Red threshold" field="errorRateRedPct" value={thresholds.errorRateRedPct} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="%" step={0.5} />
                  <ThresholdRow label="Error Rate — Yellow threshold" field="errorRateYellowPct" value={thresholds.errorRateYellowPct} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="%" step={0.1} />
                  <ThresholdRow label="Response Time — Red threshold" field="responseTimeRedMs" value={thresholds.responseTimeRedMs} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="ms" step={100} />
                  <ThresholdRow label="Response Time — Yellow threshold" field="responseTimeYellowMs" value={thresholds.responseTimeYellowMs} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="ms" step={100} />

                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", padding: "12px 0 4px", marginTop: 8, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Logs</div>
                  <ThresholdRow label="Log Errors — Red count" field="logErrorsRedCount" value={thresholds.logErrorsRedCount} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="errors" step={10} />
                  <ThresholdRow label="Log Errors — Yellow count" field="logErrorsYellowCount" value={thresholds.logErrorsYellowCount} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="errors" step={5} />

                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", padding: "12px 0 4px", marginTop: 8, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Problems & SLOs</div>
                  <ThresholdRow label="Active Problems — Red count" field="problemsRed" value={thresholds.problemsRed} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="problems" step={1} />
                  <ThresholdRow label="Active Problems — Yellow count" field="problemsYellow" value={thresholds.problemsYellow} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="problems" step={1} />

                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", padding: "12px 0 4px", marginTop: 8, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Infrastructure</div>
                  <ThresholdRow label="Host CPU — Red threshold" field="cpuRedPct" value={thresholds.cpuRedPct} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="%" step={1} />
                  <ThresholdRow label="Host CPU — Yellow threshold" field="cpuYellowPct" value={thresholds.cpuYellowPct} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="%" step={1} />
                  <ThresholdRow label="Host Memory — Red threshold" field="memRedPct" value={thresholds.memRedPct} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="%" step={1} />
                  <ThresholdRow label="Host Memory — Yellow threshold" field="memYellowPct" value={thresholds.memYellowPct} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="%" step={1} />
                  <ThresholdRow label="K8s Pod Restarts — Red count" field="podRestartsRed" value={thresholds.podRestartsRed} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="restarts" step={1} />
                  <ThresholdRow label="K8s Pod Restarts — Yellow count" field="podRestartsYellow" value={thresholds.podRestartsYellow} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="restarts" step={1} />

                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", padding: "12px 0 4px", marginTop: 8, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Security</div>
                  <ThresholdRow label="Critical Vulnerabilities — Red count" field="vulnCriticalRed" value={thresholds.vulnCriticalRed} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="vulns" step={1} />
                  <ThresholdRow label="High Vulnerabilities — Red count" field="vulnHighRed" value={thresholds.vulnHighRed} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="vulns" step={1} />
                  <ThresholdRow label="Attacks — Red count" field="attacksRed" value={thresholds.attacksRed} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="attacks" step={1} />

                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", padding: "12px 0 4px", marginTop: 8, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Digital Experience</div>
                  <ThresholdRow label="Session Error Rate — Red threshold" field="sessionErrorRateRedPct" value={thresholds.sessionErrorRateRedPct} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="%" step={0.5} />
                  <ThresholdRow label="Session Error Rate — Yellow threshold" field="sessionErrorRateYellowPct" value={thresholds.sessionErrorRateYellowPct} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="%" step={0.1} />
                  <ThresholdRow label="LCP — Red threshold" field="lcpRedMs" value={thresholds.lcpRedMs} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="ms" step={100} />
                  <ThresholdRow label="LCP — Yellow threshold" field="lcpYellowMs" value={thresholds.lcpYellowMs} onChange={(f, v) => updateThreshold(activePersona, f, v)} unit="ms" step={100} />
                </div>
              </div>
            )}

            {activeTab === "hotness" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>{activePersonaDef.icon} {activePersonaDef.label} — Heat Metrics</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                      Grail metrics used for hotness Z-score computation. Hotness is purely statistical — deviation from each metric's own mean across buckets.
                      {activePersona === "digital" && <span style={{ color: "rgba(255,180,60,0.9)" }}> Digital also uses RUM event data as a fallback when no Grail metrics return results.</span>}
                      {activePersona === "security" && <span style={{ color: "rgba(255,180,60,0.9)" }}> Security also uses attack event data as a fallback when no Grail metrics return results.</span>}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => resetPersonaHeatMetrics(activePersona)} style={{ background: "rgba(128,128,128,0.1)", border: "1px solid rgba(128,128,128,0.2)", borderRadius: 6, color: "rgba(255,255,255,0.6)", fontSize: 12, padding: "5px 12px", cursor: "pointer" }}>Reset to defaults</button>
                    <button onClick={() => addHeatMetric(activePersona)} style={{ background: "rgba(255,120,30,0.1)", border: "1px solid rgba(255,120,30,0.3)", borderRadius: 6, color: "#FF8C42", fontSize: 12, padding: "5px 12px", cursor: "pointer" }}>+ Add Metric</button>
                  </div>
                </div>
                <>
                  {getPersonaHeatMetrics(activePersona).map((metric, i) => (
                    <HeatMetricRow
                      key={i}
                      metric={metric}
                      index={i}
                      onChange={(idx, updated) => { const next = [...getPersonaHeatMetrics(activePersona)]; next[idx] = updated; updatePersonaHeatMetrics(activePersona, next); }}
                      onRemove={(idx) => { const next = getPersonaHeatMetrics(activePersona).filter((_, j) => j !== idx); updatePersonaHeatMetrics(activePersona, next); }}
                    />
                  ))}
                  {getPersonaHeatMetrics(activePersona).length === 0 && (
                    <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
                      No heat metrics configured. Click "+ Add Metric" to add one, or "Reset to defaults" to restore the built-in metrics.
                    </div>
                  )}
                  <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(255,120,30,0.06)", borderRadius: 8, border: "1px solid rgba(255,120,30,0.15)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#FF8C42", marginBottom: 6 }}>How Heat Metrics Work</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                      Each metric is queried as a timeseries over the selected timeframe. For each bucket, the Z-score is computed as (value − mean) ÷ std. The highest Z-score across all metrics becomes that bucket's heat.<br />
                      The <strong style={{ color: "#4589FF" }}>blue indicator</strong> marks traffic metrics (neutral — higher is not worse). Use <strong>Nanoseconds → ms</strong> for Dynatrace latency metrics like <code style={{ color: "#FF8C42" }}>dt.service.request.response_time</code>.
                      {activePersona === "digital" && <><br />Digital defaults use <code style={{ color: "#FF8C42" }}>ext:app.web.*</code> RUM metrics — update keys if they differ in your environment.</>}
                    </div>
                  </div>
                </>
              </div>
            )}

            {activeTab === "general" && (
              <div>
                <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#fff" }}>General Settings</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div>
                    <label style={{ ...LABEL_STYLE, fontSize: 12, marginBottom: 6 }}>Default Persona</label>
                    <CustomSelect<PersonaId>
                      value={draft.global?.defaultPersona ?? "developer"}
                      onChange={(val) => { setDraft((prev) => ({ ...prev, global: { ...prev.global, defaultPersona: val } })); markDirty(); }}
                      options={PERSONAS.map((p) => ({ value: p.id, label: `${p.icon} ${p.label}` }))}
                    />
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>Shown pre-selected in the persona picker on new sessions.</div>
                  </div>
                  <div>
                    <label style={{ ...LABEL_STYLE, fontSize: 12, marginBottom: 6 }}>Auto-refresh Interval</label>
                    <CustomSelect<number>
                      value={draft.global?.refreshIntervalMs ?? 0}
                      onChange={(val) => { setDraft((prev) => ({ ...prev, global: { ...prev.global, refreshIntervalMs: val } })); markDirty(); }}
                      options={[
                        { value: 0, label: "Off" },
                        { value: 30000, label: "30 seconds" },
                        { value: 60000, label: "1 minute" },
                        { value: 300000, label: "5 minutes" },
                      ]}
                    />
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>How often to re-run all DQL queries.</div>
                  </div>
                </div>

                <div style={{ marginTop: 28, padding: "16px 18px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>About NavigatorIQ</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
                    NavigatorIQ is an unofficial community app for Dynatrace. It is not supported by Dynatrace.<br />
                    App version: <strong style={{ color: "rgba(255,255,255,0.7)" }}>{APP_VERSION}</strong><br />
                    <a href="https://github.com/TechShady/NavigatorIQ" target="_blank" rel="noopener noreferrer" style={{ color: "#4589FF" }}>GitHub Repository</a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
