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
          The core idea: <strong style={{ color: "#fff" }}>follow the red.</strong> The heat strip and assessment drive you to what's anomalous right now. The <strong style={{ color: "#7ab4ff" }}>NavigatorIQ Launcher Intelligence</strong> narrative then tells you what it found in plain language, word by word, like a response from an AI assistant.
        </p>
        <p style={P}>
          Everything is persona-scoped. Switch personas in the header and the entire view — metrics, app links, heat strip, assessment — updates instantly.
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
          Each persona has its own heat metrics, app links, and assessment thresholds. Switch personas using the chip in the header. The Persona Picker also appears on first load so you can set your default.
        </p>
        <ul style={UL}>
          <li><strong style={{ color: "#fff" }}>Developer</strong> — services, error rate, response time, request volume</li>
          <li><strong style={{ color: "#fff" }}>SRE / Platform</strong> — host CPU, memory, disk I/O, network, process metrics</li>
          <li><strong style={{ color: "#fff" }}>DBA</strong> — database query volume, avg/P99 latency, slow queries, DB errors</li>
          <li><strong style={{ color: "#fff" }}>Network Admin</strong> — bytes sent/received, packets, retransmissions</li>
          <li><strong style={{ color: "#fff" }}>DevOps / CI/CD</strong> — services, infra, log errors, deployments</li>
          <li><strong style={{ color: "#fff" }}>Security</strong> — vulnerability severity, attack events</li>
          <li><strong style={{ color: "#fff" }}>Digital Experience</strong> — RUM LCP, sessions, Apdex, synthetic failures</li>
          <li><strong style={{ color: "#fff" }}>K8s</strong> — container CPU/memory, OOMKills, pod scheduling</li>
        </ul>
        <p style={P}>Custom personas can be added in <strong style={{ color: "#fff" }}>Settings → All Users → Personas</strong> (shared with everyone in the tenant).</p>
      </div>
    ),
  },
  {
    id: "timeframes",
    icon: "🕐",
    title: "Timeframes",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>Four timeframes control what data is queried and how finely the heat strip is bucketed:</p>
        <ul style={UL}>
          <li><strong style={{ color: "#fff" }}>Last 2 Hours</strong> — 5-minute buckets. Best for active incident investigation — the finest granularity.</li>
          <li><strong style={{ color: "#fff" }}>Today</strong> — last 24 hours, 10-minute buckets. Good for same-day trend analysis.</li>
          <li><strong style={{ color: "#fff" }}>Yesterday</strong> — the 24 hours before today, 10-minute buckets. Useful for comparing today against yesterday.</li>
          <li><strong style={{ color: "#fff" }}>Last 7 Days</strong> — 1-hour buckets. Shows weekly patterns and slow-moving degradation.</li>
        </ul>
        <p style={P}>Each tab loads independently — switching to a new tab triggers queries only for that window. Previous and current periods are both queried so the assessment can show trend direction (↑ / ↓).</p>
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
          <li><span style={{ color: "#10B981" }}>● Green dot</span> in the marker zone above a bar — a deployment event occurred in that interval</li>
          <li><span style={{ color: "#FF073A", fontWeight: 700 }}>Red number</span> in the marker zone — how many Davis Problems <em>opened</em> in that interval. In dense views (Today / 7d), shows as a size-scaled red dot instead of a number to avoid overlap</li>
          <li><strong style={{ color: "#fff" }}>Click a bar</strong> — opens Bucket Diagnosis for that specific window</li>
          <li><strong style={{ color: "#fff" }}>Click and drag across multiple bars</strong> — highlights a range with a blue tint; releasing opens Bucket Diagnosis for the hottest bucket within the selected range</li>
          <li><strong style={{ color: "#fff" }}>🔥 Hotness Assist</strong> — deep-dive analysis panel for the full timeline</li>
          <li><strong style={{ color: "#fff" }}>📅 Calendar</strong> — day × hour heatmap showing when your environment runs hot across an extended window</li>
          <li><strong style={{ color: "#fff" }}>📈 Forecast</strong> — projects metric trends using multiple forecasting models</li>
        </ul>
      </div>
    ),
  },
  {
    id: "narrative",
    icon: "✦",
    title: "NavigatorIQ Launcher Intelligence",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>
          Below the heat strip, the <strong style={{ color: "#7ab4ff" }}>NavigatorIQ Launcher Intelligence</strong> section generates a plain-language narrative of the current assessment. It prints word by word — like a response from an AI assistant — so you can read it as it arrives rather than waiting for a wall of text.
        </p>
        <ul style={UL}>
          <li>Opens with a context sentence: how many critical issues were found and over what timeframe</li>
          <li>Each critical item gets its own sentence with the metric value, trend direction, and an inline recommendation</li>
          <li>Yellow (warning) items are grouped together as "Also watching: …"</li>
          <li>If request volume changed by 15% or more, a traffic note is added</li>
          <li>When everything is healthy, the narrative confirms the metric values that validated green status</li>
        </ul>
        <p style={P}>The narrative refreshes whenever you switch timeframes, change personas, or hit the ⟳ refresh button.</p>
      </div>
    ),
  },
  {
    id: "bucket-diag",
    icon: "🔍",
    title: "Bucket Diagnosis",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>
          Click any bar in the heat strip to open <strong style={{ color: "#fff" }}>Bucket Diagnosis</strong> — a popup that shows every metric value for that specific time window side by side. The popup is draggable and scrollable.
        </p>
        <ul style={UL}>
          <li>Each metric row shows the Z-score, raw value, and a color band matching its heat level</li>
          <li>Click the <strong style={{ color: "#fff" }}>↗ Explore</strong> button on any metric row to open the Explore panel for that metric</li>
          <li>Click <strong style={{ color: "#fff" }}>Why is this hot?</strong> for a narrative explanation of what drove the anomaly in that bucket</li>
        </ul>
      </div>
    ),
  },
  {
    id: "explore",
    icon: "↗",
    title: "Explore",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>
          The <strong style={{ color: "#fff" }}>Explore</strong> panel opens when you click a metric in the Bucket Diagnosis popup or from Hotness Assist. It gives a deeper look at a single metric over the full timeframe.
        </p>
        <ul style={UL}>
          <li>Sparkline with the metric's full time-series at bucket granularity</li>
          <li>Entity-level breakdown — for supported metrics, shows a ranked list of the top contributing entities (services, hosts, etc.)</li>
          <li>Diagnosis scenarios: a list of checks for that metric with CRITICAL / REVIEW / OK status and a recommended action</li>
          <li>Direct link to the relevant Dynatrace app for deeper investigation</li>
          <li>For Digital Experience metrics, a <strong style={{ color: "#fff" }}>Dimension</strong> button opens a geo + browser breakdown with pie charts</li>
        </ul>
        <p style={P}>The Explore panel is draggable and resizable.</p>
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
          Click <strong style={{ color: "#fff" }}>🔥 Hotness Assist</strong> to open a full-timeline analysis panel. The panel is draggable.
        </p>
        <ul style={UL}>
          <li><strong style={{ color: "#fff" }}>KPI Tiles</strong> — hot bucket count, critical spike count, worst and best Z-scores</li>
          <li><strong style={{ color: "#fff" }}>Analysis Summary</strong> — narrative describing what happened and when</li>
          <li><strong style={{ color: "#fff" }}>Hotness Timeline</strong> — mini sparkline with worst/best bucket markers</li>
          <li><strong style={{ color: "#fff" }}>Activity Pattern</strong> — classified as Stable, Transient, Sustained, or Chronic degradation</li>
          <li><strong style={{ color: "#fff" }}>Worst vs Best buckets</strong> — side-by-side metric breakdown for the hottest and coolest intervals</li>
          <li><strong style={{ color: "#fff" }}>Gap Table</strong> — how much each metric improved from worst to best bucket</li>
          <li><strong style={{ color: "#fff" }}>Cross-Metric Correlation</strong> — shows which metric pairs co-spiked. <em>Co-hot</em> = number of buckets both were elevated at the same time; <em>Rate</em> = % of Metric A's elevated buckets where Metric B was also elevated. A high Rate means a strong directional link.</li>
          <li><strong style={{ color: "#fff" }}>Insights & Recommendations</strong> — observations derived from metric patterns</li>
          <li><strong style={{ color: "#fff" }}>Davis Problems</strong> — active Problems during the timeframe (if any)</li>
          <li><strong style={{ color: "#fff" }}>Next Steps</strong> — Investigate buttons for every metric exceeding its threshold</li>
        </ul>
      </div>
    ),
  },
  {
    id: "calendar",
    icon: "📅",
    title: "Hotness Calendar",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>
          Click the <strong style={{ color: "#fff" }}>📅</strong> button beside Hotness Assist to open the <strong style={{ color: "#fff" }}>Hotness Calendar</strong> — a day-of-week × hour-of-day heatmap that shows when your environment typically runs hot.
        </p>
        <p style={P}>
          Each cell represents one hour slot aggregated across multiple days of history. The color reflects the worst Z-score seen during that hour, using the same scale as the heat strip. This makes it easy to spot recurring patterns: weekly peak times, overnight batch jobs, Monday morning spikes.
        </p>
        <ul style={UL}>
          <li>Select <strong style={{ color: "#fff" }}>7 days</strong>, <strong style={{ color: "#fff" }}>14 days</strong>, or <strong style={{ color: "#fff" }}>30 days</strong> of history to aggregate</li>
          <li>Hover any cell to see the exact Z-score range and tooltip</li>
          <li>Use it to distinguish "this is always hot on Monday at 9am" from "something unusual is happening right now"</li>
        </ul>
        <p style={P}>The calendar panel is draggable.</p>
      </div>
    ),
  },
  {
    id: "kpi-heatmap",
    icon: "🗓️",
    title: "KPI Heatmap (per metric)",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>
          Each metric in the assessment can show its own <strong style={{ color: "#fff" }}>KPI Heatmap</strong> — a day × hour calendar scoped to that single metric rather than the aggregated heat score.
        </p>
        <p style={P}>
          This lets you see exactly which hours and days a specific metric (e.g. Error Rate, or CPU Usage) runs worst — independently of whether other metrics are elevated at the same time. Useful for targeted SLO analysis or capacity planning.
        </p>
        <ul style={UL}>
          <li>Values are shown in the metric's native unit (ms, %, count) on hover</li>
          <li>Color scale uses relative Z-scoring within the metric's own history</li>
          <li>Best / worst hour and best / worst day are highlighted with a ring</li>
        </ul>
      </div>
    ),
  },
  {
    id: "forecast",
    icon: "📈",
    title: "Forecast",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>
          Click <strong style={{ color: "#fff" }}>📈 Forecast</strong> from the assessment to project a metric's trend forward. The panel is draggable.
        </p>
        <p style={P}>Six forecasting models are available — select the one that fits the metric's behavior:</p>
        <ul style={UL}>
          <li><strong style={{ color: "#fff" }}>Linear</strong> — straight-line extrapolation. Best for steadily trending metrics.</li>
          <li><strong style={{ color: "#fff" }}>Holt-Winters</strong> — double exponential smoothing. Tracks level and trend, adapts to acceleration/deceleration.</li>
          <li><strong style={{ color: "#fff" }}>Triple Exp</strong> — triple exponential smoothing with seasonality. Good for metrics with a repeating daily/weekly pattern.</li>
          <li><strong style={{ color: "#fff" }}>Prophet</strong> — piecewise trend with changepoint detection. Handles sudden shifts in baseline well.</li>
          <li><strong style={{ color: "#fff" }}>ARIMA</strong> — auto-regressive integrated moving average. Good general-purpose model for stationary time series.</li>
          <li><strong style={{ color: "#fff" }}>SARIMA</strong> — seasonal ARIMA. Best when the metric has strong, consistent seasonality.</li>
        </ul>
        <p style={P}>A confidence band (shaded area) is shown around the forecast to indicate uncertainty — wider = less confident. The history period shown matches the current timeframe tab.</p>
      </div>
    ),
  },
  {
    id: "settings-personal",
    icon: "⚙️",
    title: "Settings — Personal (per user)",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>Personal settings are saved per-user in Dynatrace user state. Each person in the tenant has their own independent configuration. Open Settings from the ⚙️ button in the header.</p>

        <p style={{ ...H3, marginTop: 12 }}>🔗 App Links</p>
        <p style={P}>
          Configure which Dynatrace apps appear in the right-hand sidebar for each persona. Each link has a label, an app path (e.g. <code style={CODE}>dynatrace.classic.services</code>), and an optional docs URL. The colored dot toggles visibility on/off.
        </p>

        <p style={{ ...H3, marginTop: 12 }}>🎯 Assessment Thresholds</p>
        <p style={P}>
          Numeric thresholds that determine Red/Yellow/Green status for assessment items — error rate, response time, CPU usage, etc. Defaults are sensible starting points; adjust to match your environment's SLOs.
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
            Two metric keys divided to produce a ratio (e.g. failure count ÷ total requests = error rate %). Result shown as a percentage.
          </li>
          <li>
            <span style={BADGE("#FF8C42")}>DQL</span>
            Any custom DQL query. Must return a <code style={CODE}>value</code> column per time bucket. Supports placeholders: <code style={CODE}>{"${from}"}</code>, <code style={CODE}>{"${to}"}</code>, <code style={CODE}>{"${interval}"}</code>.
          </li>
        </ul>
        <p style={P}>
          For each metric: set <strong style={{ color: "#fff" }}>Warning</strong> and <strong style={{ color: "#fff" }}>Critical</strong> thresholds. The colored square toggles the metric between Traffic (blue — high values are expected/normal) and Performance (orange — high values indicate a problem).
        </p>

        <p style={{ ...H3, marginTop: 12 }}>⚙️ General</p>
        <p style={P}>Set your default persona and auto-refresh interval. Set to 0 for manual refresh only; set to 300000 (5 min) for hands-free incident watch.</p>
      </div>
    ),
  },
  {
    id: "settings-shared",
    icon: "👥",
    title: "Settings — All Users (shared)",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>Shared settings are visible to everyone in the tenant. Found in the <strong style={{ color: "#fff" }}>All Users</strong> section of the Settings panel.</p>

        <p style={{ ...H3, marginTop: 12 }}>👤 Custom Personas</p>
        <p style={P}>
          Add custom personas visible to all users. Each persona has an icon (emoji), label, and description. Built-in personas cannot be removed. Custom personas support their own heat metrics and app links, configurable per-user just like built-in ones.
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
          <li>The <strong style={{ color: "#fff" }}>dot</strong> next to each app is green when marked installed, grey otherwise</li>
          <li>Click the app name button to open it in the Dynatrace platform</li>
          <li>Click <strong style={{ color: "#fff" }}>Docs</strong> to open its documentation URL</li>
          <li>Assessment items with an <code style={CODE}>exploreAppPath</code> link directly into that app's relevant view</li>
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

        <p style={{ ...H3, marginTop: 12 }}>Database call volume (any DB, any framework)</p>
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

        <p style={{ ...H3, marginTop: 12 }}>RUM conversion funnel step</p>
        <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "10px 12px", marginBottom: 10, fontFamily: "monospace", fontSize: 11.5, color: "#a8d1ff", lineHeight: 1.6 }}>
          {"fetch user.events, from:${from}, to:${to}"}<br />
          {'| fieldsAdd slot = bin(start_time, ${interval})'}<br />
          {"| summarize steps=collectDistinct(view.name), by:{dt.rum.session.id, slot}"}<br />
          {"| summarize"}<br />
          {'  total=countIf(iAny(steps[] == "/checkout")), by:{slot}'}<br />
          {"| fieldsAdd value=toDouble(total)"}
        </div>

        <p style={{ ...H3, marginTop: 12 }}>Active Davis Problems count</p>
        <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "10px 12px", marginBottom: 10, fontFamily: "monospace", fontSize: 11.5, color: "#a8d1ff", lineHeight: 1.6 }}>
          {"fetch dt.davis.problems, from:${from}, to:${to}"}<br />
          {'| filter event.status == "ACTIVE"'}<br />
          {"| summarize value=count()"}
        </div>

        <p style={P}>
          <strong style={{ color: "#fff" }}>Key DQL field names for NavigatorIQ:</strong> Use <code style={CODE}>fetch dt.davis.problems</code> (not <code style={CODE}>fetch events</code>) for Davis problems. Status is <code style={CODE}>event.status == "ACTIVE"</code>. Problem name is <code style={CODE}>event.name</code>. Log errors use <code style={CODE}>status == "ERROR"</code> (not <code style={CODE}>log.level</code>).
        </p>
        <p style={P}>
          <strong style={{ color: "#fff" }}>now() in DQL:</strong> <code style={CODE}>now()</code> only works in <code style={CODE}>from:</code> / <code style={CODE}>to:</code> parameters on the fetch line. It is not valid inside a pipeline stage. Use the <code style={CODE}>{"${from}"}</code> / <code style={CODE}>{"${to}"}</code> placeholders instead — NavigatorIQ substitutes the correct absolute timestamps automatically.
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
          <li>Use <strong style={{ color: "#fff" }}>Last 2 Hours</strong> (5-min buckets) to pinpoint exactly when an incident started</li>
          <li><strong style={{ color: "#fff" }}>Red numbers / dots</strong> above bars mark Davis Problems that <em>opened</em> in that interval — correlate with heat spikes to confirm causality</li>
          <li><strong style={{ color: "#fff" }}>Green dots</strong> mark deployment events — a red bar right after a green dot is worth investigating immediately</li>
          <li>Click a bar to see all metric values for <em>that specific window</em>, or <strong style={{ color: "#fff" }}>drag across several bars</strong> to select a range — the hottest bucket in the range opens automatically</li>
          <li>The <strong style={{ color: "#fff" }}>Cross-Metric Correlation</strong> table in Hotness Assist tells you which metrics move together — a Rate near 100% means one metric almost always spikes with the other</li>
          <li>Open the <strong style={{ color: "#fff" }}>Hotness Calendar</strong> to separate recurring patterns (Monday peaks, overnight batch) from genuine anomalies</li>
          <li>Drag Hotness Assist, Forecast, and Explore panels anywhere on screen to keep them visible while you investigate in other panels</li>
          <li>The <strong style={{ color: "#fff" }}>⟳ refresh button</strong> re-runs all queries without changing the timeframe</li>
          <li>Auto-refresh (Settings → General → 300000 ms) is ideal for incident watch rooms — the heat strip stays live without manual intervention</li>
          <li>Per-user settings mean teammates can have completely different metric configs and thresholds without affecting each other</li>
          <li>Custom personas from Settings → All Users appear for everyone in the tenant — useful for specialized teams or cross-functional squads</li>
          <li>The <strong style={{ color: "#fff" }}>NavigatorIQ Launcher Intelligence</strong> narrative is the fastest way to brief someone mid-incident — it reads like a summary from an analyst, not a raw metric dump</li>
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
          <div style={{ width: 210, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, overflowY: "auto" }}>
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
