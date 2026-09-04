import React, { useState } from "react";
import { createPortal } from "react-dom";

interface HelpSection {
  id: string;
  icon: string;
  title: string;
  content: React.ReactNode;
}

const SECTION_STYLE: React.CSSProperties = {
  marginBottom: 28,
};

const H3: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#7ab4ff",
  marginBottom: 8,
  marginTop: 0,
};

const P: React.CSSProperties = {
  fontSize: 12.5,
  color: "rgba(255,255,255,0.75)",
  lineHeight: 1.7,
  margin: "0 0 8px",
};

const UL: React.CSSProperties = {
  margin: "0 0 8px",
  paddingLeft: 18,
  fontSize: 12.5,
  color: "rgba(255,255,255,0.75)",
  lineHeight: 1.7,
};

const CODE: React.CSSProperties = {
  background: "rgba(69,137,255,0.12)",
  border: "1px solid rgba(69,137,255,0.2)",
  borderRadius: 3,
  padding: "1px 5px",
  fontSize: 11.5,
  fontFamily: "monospace",
  color: "#a8d1ff",
};

const BADGE = (color: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 700,
  background: `${color}18`,
  border: `1px solid ${color}40`,
  color,
  marginRight: 4,
});

const SECTIONS: HelpSection[] = [
  {
    id: "overview",
    icon: "🧭",
    title: "What is NavigatorIQ Launcher?",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>
          NavigatorIQ Launcher is a persona-driven operational intelligence dashboard for Dynatrace. It gives each persona (Developer, DBA, Network Admin, Security, etc.) a focused heat-based view of the metrics that matter most to them — and then gets out of the way, launching you directly into the right Dynatrace app to investigate.
        </p>
        <p style={P}>
          The core idea: <strong style={{ color: "#fff" }}>follow the red.</strong> The heat strip and assessment drive you to what's anomalous right now. Everything else is one click away.
        </p>
      </div>
    ),
  },
  {
    id: "personas",
    icon: "👤",
    title: "Personas",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>
          Each persona has its own heat metrics, app links, and assessment thresholds. Switch personas using the chip in the header, or click it to open a dropdown. The Persona Picker also shows on first load so you can set your default.
        </p>
        <ul style={UL}>
          <li><strong style={{ color: "#fff" }}>Developer</strong> — services, errors, response time, request volume</li>
          <li><strong style={{ color: "#fff" }}>DBA</strong> — database query volume, latency, errors, N+1 patterns</li>
          <li><strong style={{ color: "#fff" }}>Network Admin</strong> — bytes sent/received, packets, retransmissions</li>
          <li><strong style={{ color: "#fff" }}>DevOps/CI/CD</strong> — services, infra, log errors, deployments</li>
          <li><strong style={{ color: "#fff" }}>Security</strong> — vulnerability severity, attack events</li>
          <li><strong style={{ color: "#fff" }}>SRE/Platform</strong> — host CPU/memory timelines</li>
          <li><strong style={{ color: "#fff" }}>Digital Experience</strong> — RUM LCP, sessions, synthetic failures</li>
          <li><strong style={{ color: "#fff" }}>K8s</strong> — pod restarts, OOMKills, unschedulable nodes</li>
        </ul>
        <p style={P}>Custom personas can be added in <strong style={{ color: "#fff" }}>Settings → Personas</strong> (shared with all users in the tenant).</p>
      </div>
    ),
  },
  {
    id: "timeframes",
    icon: "🕐",
    title: "Timeframes",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>Four timeframes control what data is queried and what bucket size the heat strip uses:</p>
        <ul style={UL}>
          <li><strong style={{ color: "#fff" }}>Last 2 Hours</strong> — 5-minute buckets, best for active incident investigation</li>
          <li><strong style={{ color: "#fff" }}>Today</strong> — from midnight, hourly buckets</li>
          <li><strong style={{ color: "#fff" }}>Yesterday</strong> — full prior day, hourly buckets</li>
          <li><strong style={{ color: "#fff" }}>Last 7 Days</strong> — weekly trend, 6-hour buckets</li>
        </ul>
        <p style={P}>Each tab loads independently — switching to a tab you haven't visited triggers fresh queries for that window.</p>
      </div>
    ),
  },
  {
    id: "heatstrip",
    icon: "📊",
    title: "Activity Heat Strip",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>
          The heat strip aggregates all your heat metrics into a single Z-score per time bucket. Z-score = how many standard deviations above the mean this bucket is. This makes spikes visible even when absolute values differ wildly across metrics.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {[
            { color: "#4589FF", label: "Normal", desc: "Z < 0.75" },
            { color: "#FFF04D", label: "Elevated", desc: "Z ≥ 0.75" },
            { color: "#FF3D9A", label: "Warm", desc: "Z ≥ 1.5" },
            { color: "#FF073A", label: "Spike", desc: "Z ≥ 2.5" },
          ].map((c) => (
            <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6, background: `${c.color}10`, border: `1px solid ${c.color}30`, borderRadius: 6, padding: "5px 10px" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c.color }} />
              <span style={{ fontSize: 12, color: c.color, fontWeight: 700 }}>{c.label}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{c.desc}</span>
            </div>
          ))}
        </div>
        <ul style={UL}>
          <li><span style={{ color: "#10B981" }}>● Green dot</span> above a bar — a deployment event occurred in that interval</li>
          <li><strong style={{ color: "#fff" }}>Click a bar</strong> — opens Bucket Diagnosis showing all metric values for that specific window</li>
          <li><strong style={{ color: "#fff" }}>🔥 Hotness Assist</strong> — AI-style analysis panel for the full timeline</li>
          <li><strong style={{ color: "#fff" }}>📈 Forecast</strong> — projects metric trends using linear regression</li>
        </ul>
      </div>
    ),
  },
  {
    id: "hotness-assist",
    icon: "🔥",
    title: "Hotness Assist",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>
          Click <strong style={{ color: "#fff" }}>🔥 Hotness Assist</strong> to open a detailed breakdown. The panel is draggable.
        </p>
        <ul style={UL}>
          <li><strong style={{ color: "#fff" }}>KPI Tiles</strong> — hot bucket count, critical spike count, worst and best Z-scores</li>
          <li><strong style={{ color: "#fff" }}>Analysis Summary</strong> — narrative describing what happened and when</li>
          <li><strong style={{ color: "#fff" }}>Hotness Timeline</strong> — mini sparkline with worst/best markers</li>
          <li><strong style={{ color: "#fff" }}>Activity Pattern</strong> — classified as Stable, Transient, Sustained, or Chronic degradation</li>
          <li><strong style={{ color: "#fff" }}>Worst vs Best buckets</strong> — side-by-side metric breakdown for the hottest and coolest intervals</li>
          <li><strong style={{ color: "#fff" }}>Gap Table</strong> — how much each metric improved from worst to best bucket</li>
          <li><strong style={{ color: "#fff" }}>Insights & Recommendations</strong> — observations derived from metric patterns</li>
          <li><strong style={{ color: "#fff" }}>Davis Problems</strong> — open Davis AI problems during the timeframe (if any)</li>
          <li><strong style={{ color: "#fff" }}>Next Steps</strong> — Investigate buttons for every metric exceeding its threshold, with optional GitHub deploy link for community apps not yet installed</li>
        </ul>
      </div>
    ),
  },
  {
    id: "settings-personal",
    icon: "⚙️",
    title: "Settings — Personal (per user)",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>Personal settings are saved per-user. Each user in the tenant has their own configuration. These are found in the <strong style={{ color: "#fff" }}>Personal</strong> section of the Settings tab bar.</p>

        <p style={{ ...H3, marginTop: 12 }}>🔗 App Links</p>
        <p style={P}>
          Configure which Dynatrace apps appear in the right-hand sidebar for each persona. Each link has a label, an app path (e.g. <code style={CODE}>dynatrace.classic.services</code>), and an optional docs URL. The colored dot toggles visibility on/off.
        </p>

        <p style={{ ...H3, marginTop: 12 }}>🎯 Assessment Thresholds</p>
        <p style={P}>
          Numeric thresholds that determine Red/Yellow/Green status for the assessment items — things like error rate, response time, CPU usage. Defaults are sensible starting points; adjust to match your environment's SLOs.
        </p>

        <p style={{ ...H3, marginTop: 12 }}>🔥 Hotness Metrics</p>
        <p style={P}>Configure what data drives the heat strip for each persona. Three metric types:</p>
        <ul style={UL}>
          <li>
            <span style={BADGE("#4589FF")}>Single</span>
            A single DT metric key (e.g. <code style={CODE}>dt.host.cpu.usage</code>). Choose aggregation (avg/sum) and display unit.
          </li>
          <li>
            <span style={BADGE("#7C3AED")}>A÷B</span>
            Two metric keys divided to produce a ratio (e.g. failure count ÷ total requests = error rate %). Result is shown as a percentage.
          </li>
          <li>
            <span style={BADGE("#FF8C42")}>DQL</span>
            Any custom DQL query. Must return a <code style={CODE}>value</code> column. Use <code style={CODE}>makeTimeseries value=…</code> for a time-bucketed result or one row per bucket. Supports placeholders: <code style={CODE}>{"${from}"}</code>, <code style={CODE}>{"${to}"}</code>, <code style={CODE}>{"${interval}"}</code>.
          </li>
        </ul>
        <p style={P}>
          For each metric: set <strong style={{ color: "#fff" }}>Warning</strong> and <strong style={{ color: "#fff" }}>Critical</strong> thresholds (optional — traffic metrics like Request Volume have none). The colored square toggles the metric between Traffic (blue — high values are normal) and Performance (orange — high values are bad).
        </p>
        <p style={P}>
          Metrics with a <strong style={{ color: "#fff" }}>GitHub URL</strong> require a community app. The Hotness Assist Next Steps will show a Deploy from GitHub link until the app is detected as installed.
        </p>

        <p style={{ ...H3, marginTop: 12 }}>⚙️ General</p>
        <p style={P}>Set your default persona and auto-refresh interval (0 = manual refresh only).</p>
      </div>
    ),
  },
  {
    id: "settings-shared",
    icon: "👥",
    title: "Settings — All Users (shared)",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>Shared settings are visible to everyone in the tenant. Found in the <strong style={{ color: "#fff" }}>All Users</strong> section of the Settings tab bar.</p>

        <p style={{ ...H3, marginTop: 12 }}>👤 Personas</p>
        <p style={P}>
          Add custom personas visible to all users. Each persona has an icon (emoji), label, and description. Built-in personas cannot be removed but can be ignored. Custom personas can be configured with their own heat metrics and app links just like built-in ones.
        </p>
      </div>
    ),
  },
  {
    id: "app-links",
    icon: "🔗",
    title: "App Links Panel",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>
          The right sidebar shows quick-launch buttons for the current persona's configured apps. Use it to jump from NavigatorIQ straight into the right Dynatrace app once you've identified an issue.
        </p>
        <ul style={UL}>
          <li>The <strong style={{ color: "#fff" }}>dot</strong> next to each app is green when installed, grey when not</li>
          <li>Click the app name button to open it in a new tab</li>
          <li>Click <strong style={{ color: "#fff" }}>Docs</strong> to open the documentation URL</li>
          <li>Grayed-out apps are still clickable — you'll be sent to the DT app catalog</li>
        </ul>
      </div>
    ),
  },
  {
    id: "dql-tips",
    icon: "💡",
    title: "DQL Metric Tips",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>Custom DQL metrics are the most powerful feature. Some patterns that work well:</p>

        <p style={{ ...H3, marginTop: 12 }}>Span-based (any database, any framework)</p>
        <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "10px 12px", marginBottom: 10, fontFamily: "monospace", fontSize: 11.5, color: "#a8d1ff", lineHeight: 1.6 }}>
          {"fetch spans, from:${from}, to:${to}"}<br />
          {"| filter isNotNull(db.system)"}<br />
          {"| makeTimeseries value=count(), interval:${interval}"}
        </div>

        <p style={{ ...H3, marginTop: 12 }}>Log error count over time</p>
        <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "10px 12px", marginBottom: 10, fontFamily: "monospace", fontSize: 11.5, color: "#a8d1ff", lineHeight: 1.6 }}>
          {'fetch logs, from:${from}, to:${to}'}<br />
          {'| filter status == "ERROR" or status == "FATAL"'}<br />
          {"| makeTimeseries value=count(), interval:${interval}"}
        </div>

        <p style={{ ...H3, marginTop: 12 }}>RUM conversion rate</p>
        <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "10px 12px", marginBottom: 10, fontFamily: "monospace", fontSize: 11.5, color: "#a8d1ff", lineHeight: 1.6 }}>
          {"fetch user.events, from:${from}, to:${to}"}<br />
          {'| fieldsAdd slot = bin(start_time, ${interval})'}<br />
          {"| summarize steps=collectDistinct(view.name), by:{dt.rum.session.id, slot}"}<br />
          {"| summarize"}<br />
          {'  total=countIf(iAny(steps[] == "/checkout")), by:{slot}'}<br />
          {"| fieldsAdd value=toDouble(total)"}
        </div>

        <p style={P}>
          <strong style={{ color: "#fff" }}>Zero-baseline:</strong> If your DQL query returns 0 records (no events in the window), the metric still appears in the heat chart as a flat zero — it won't disappear. This is intentional.
        </p>
        <p style={P}>
          <strong style={{ color: "#fff" }}>Thresholds with hourly scale:</strong> For count metrics running at 5-minute intervals, use <code style={CODE}>thresholdBucketHours: 1</code> in custom metric definitions so thresholds are specified as "per hour" and automatically scaled to the bucket size.
        </p>
      </div>
    ),
  },
  {
    id: "tips",
    icon: "⚡",
    title: "Pro Tips",
    content: (
      <div style={SECTION_STYLE}>
        <ul style={UL}>
          <li>Use <strong style={{ color: "#fff" }}>Last 2 Hours</strong> to investigate active incidents — 5-minute buckets give you the granularity to pinpoint when things went wrong</li>
          <li>Click a heat strip bar to diagnose <em>that specific time bucket</em> — all metric values for that window appear side by side</li>
          <li>Drag Hotness Assist and the Forecast panel anywhere on screen to keep them visible while you work in other panels</li>
          <li>The <strong style={{ color: "#fff" }}>⟳ refresh button</strong> in the header re-runs all queries without changing the timeframe</li>
          <li>Auto-refresh (Settings → General) is useful for incident watch — set to 5 minutes to stay current</li>
          <li>Per-user settings mean teammates can have completely different metric configurations without affecting each other</li>
          <li>Custom personas from Settings → Personas appear in the persona picker for everyone — great for specialized teams</li>
          <li>Green deployment dots on the heat strip help correlate "when did we deploy?" with "when did things spike?"</li>
          <li>Davis Problems in Hotness Assist shows open problems from Davis AI for quick context during investigation</li>
        </ul>
      </div>
    ),
  },
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [activeSection, setActiveSection] = useState("overview");
  const section = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 99998, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#0f1422", border: "1px solid rgba(69,137,255,0.25)", borderRadius: 14, width: "100%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.85)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "18px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>🧭 NavigatorIQ Launcher — Help Guide</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Everything you need to get the most out of NavigatorIQ Launcher</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(128,128,128,0.15)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, color: "rgba(255,255,255,0.7)", fontSize: 13, padding: "8px 16px", cursor: "pointer" }}>
            Close
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {/* Nav */}
          <div style={{ width: 200, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, overflowY: "auto" }}>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 10px", borderRadius: 6, border: "none",
                  background: activeSection === s.id ? "rgba(69,137,255,0.15)" : "transparent",
                  color: activeSection === s.id ? "#fff" : "rgba(255,255,255,0.55)",
                  fontSize: 12, fontWeight: activeSection === s.id ? 600 : 400,
                  cursor: "pointer", textAlign: "left", width: "100%",
                  outline: activeSection === s.id ? "1px solid rgba(69,137,255,0.3)" : "none",
                }}
              >
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <span style={{ lineHeight: 1.3 }}>{s.title}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <span style={{ fontSize: 22 }}>{section.icon}</span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>{section.title}</h3>
            </div>
            {section.content}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
