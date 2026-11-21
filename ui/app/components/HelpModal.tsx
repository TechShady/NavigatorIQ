import { PopupWindow, PopupCloseButton } from "./PopupWindow";
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
          NavigatorIQ Launcher is a persona-driven operational intelligence dashboard for Dynatrace. It gives each persona (Developer, DBA, Network Admin, Mobile Experience, etc.) a focused heat-based view of the metrics that matter most to them, with contextual links to investigate in Dynatrace.
        </p>
        <p style={P}>
          The core idea: <strong style={{ color: "#fff" }}>follow the red.</strong> The heat strip and assessment drive you to what's anomalous right now. The <strong style={{ color: "#7ab4ff" }}>NavigatorIQ Launcher Intelligence</strong> narrative then tells you what it found in plain language, word by word, like a response from an AI assistant.
        </p>
        <p style={P}>
          Everything is persona-scoped. Switch personas in the header and the entire view — metrics, heat strip, and assessment — updates instantly.
        </p>
        <p style={P}>
          <strong style={{ color: "#fff" }}>Activity &amp; Spikes</strong> is expanded by default for investigating unusual intervals. Expand <strong style={{ color: "#fff" }}>Timeframe Assessment</strong> for the narrative and metric status; its critical and warning counts remain visible when collapsed. The sections can be opened or closed independently.
        </p>
        <p style={P}>Use the maximize control beside a popup's close button to fill the app viewport; restore it to return to its previous size and position. Content remains scrollable.</p>
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
          Each persona has its own heat metrics and assessment thresholds. Switch personas using the chip in the header. The Persona Picker also appears on first load so you can set your default.
        </p>
        <ul style={UL}>
          <li><strong style={{ color: "#fff" }}>Developer</strong> — services, error rate, response time, request volume</li>
          <li><strong style={{ color: "#fff" }}>SRE</strong> — service errors, traffic, latency, CPU and memory saturation</li>
          <li><strong style={{ color: "#fff" }}>Platform Engineer</strong> — host CPU, memory, disk I/O, network, process metrics</li>
          <li><strong style={{ color: "#fff" }}>DBA</strong> — database query volume, avg/P99 latency, slow queries, DB errors</li>
          <li><strong style={{ color: "#fff" }}>Network Admin</strong> — bytes sent/received, packets, retransmissions</li>
          <li><strong style={{ color: "#fff" }}>DevOps / CI/CD</strong> — services, infra, log errors, deployments</li>
          <li><strong style={{ color: "#fff" }}>Digital Experience</strong> — web vitals, action duration, errors and requests</li>
          <li><strong style={{ color: "#fff" }}>Mobile Experience</strong> — sessions, errors, error rate, crashes and crash rate</li>
          <li><strong style={{ color: "#fff" }}>K8s</strong> — container CPU/memory, OOMKills, pod scheduling</li>
        </ul>
        <p style={P}>Mobile Experience includes per-app drill-downs and defaults its row links to Mobile Navigation, which must be installed and accessible. Existing personal overrides remain; use Reset to defaults for that persona to restore the built-in metrics and links. Set thresholds for your environment.</p>
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
          <li><strong style={{ color: "#fff" }}>Click and drag across multiple bars</strong> — selects a range; click <strong style={{ color: "#fff" }}>Zoom in</strong> in the selection popup to reload the app for that window. Use <strong style={{ color: "#fff" }}>✕ Exit zoom</strong> to return to the full tab window.</li>
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
          Expand <strong style={{ color: "#fff" }}>Timeframe Assessment</strong> below the heat strip for the <strong style={{ color: "#7ab4ff" }}>NavigatorIQ Launcher Intelligence</strong> narrative, a plain-language summary of the current assessment.
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
          <li>Click <strong style={{ color: "#fff" }}>Follow the Red ↗</strong> on an eligible metric row to open its drill-down panel</li>
          <li>The <strong style={{ color: "#fff" }}>Why is this hot?</strong> popup identifies a primary driver and, when present, concurrent elevated signals</li>
        </ul>
      </div>
    ),
  },
  {
    id: "explore",
    icon: "↗",
    title: "Follow the Red",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>
          Click <strong style={{ color: "#fff" }}>Follow the Red</strong> on an eligible Bucket Diagnosis row to see contributors for that metric in the selected timeframe.
        </p>
        <ul style={UL}>
          <li>Supported metrics show entity or configured dimension rows; custom DQL can supply its own breakdown.</li>
          <li>Available row pills include Forecast, Diagnose, Baseline, Cost Impact, Heatmap, Dimension, Impact and Anomaly. Availability and detail depend on the metric and data.</li>
          <li>Use <strong style={{ color: "#fff" }}>Open in Dynatrace</strong> where available to continue investigating. Digital Experience can show geographic and browser dimensions; Mobile Experience supports country and OS breakdowns.</li>
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
          Click <strong style={{ color: "#fff" }}>🔥 Hotness Assist</strong> to open a full-timeline analysis panel. The panel is draggable.
        </p>
        <ul style={UL}>
          <li><strong style={{ color: "#fff" }}>KPI Tiles</strong> — hot bucket count, critical spike count, worst and best Z-scores</li>
          <li><strong style={{ color: "#fff" }}>Analysis Summary</strong> — animated summary and possible leading indicators to investigate</li>
          <li><strong style={{ color: "#fff" }}>Hotness Timeline</strong> — sparkline with W1/W2 (worst) and B1/B2 (best) bucket markers labeled directly on the chart</li>
          <li><strong style={{ color: "#fff" }}>Pattern Analysis</strong> — Stable, Transient, Sustained, or Chronic; plus Spike Behavior stats (episode count, longest run, avg recovery)</li>
          <li><strong style={{ color: "#fff" }}>Cross-Metric Correlation</strong> — which metric pairs co-spiked. <em>Co-hot</em> = buckets both elevated; <em>Rate</em> = % of Metric A's hot buckets where B was also hot. Co-occurrence is a lead, not proof of causation.</li>
          <li><strong style={{ color: "#fff" }}>What's Different — W1 vs B1</strong> — side-by-side breakdown of worst vs best bucket, plus Gap Table showing how much each metric improved</li>
          <li><strong style={{ color: "#fff" }}>Common Bad Signals — W1 vs W2</strong> — metrics elevated in <em>both</em> worst windows; persistent signals are your strongest leads</li>
          <li><strong style={{ color: "#fff" }}>Common Good Signals — B1 vs B2</strong> — metrics healthy in <em>both</em> best windows; your true baseline and SLO reference</li>
          <li><strong style={{ color: "#fff" }}>Insights & Recommendations</strong> — observations and prioritized actions derived from metric patterns</li>
          <li><strong style={{ color: "#fff" }}>Advanced Signals</strong> — SLO breach estimate, cascade sequences, traffic efficiency anomalies (shown when detected)</li>
          <li><strong style={{ color: "#fff" }}>Next Steps</strong> — Investigate buttons for every metric exceeding its threshold</li>
          <li><strong style={{ color: "#fff" }}>Active Davis Problems</strong> — open Problems during the timeframe, listed at bottom as contextual reference</li>
        </ul>
        <p style={P}>Assist excludes missing or invalid buckets, all-zero buckets, and the final potentially incomplete bucket from its analysis. Individual zero values remain valid when another metric has data. If no eligible buckets remain, Assist reports no data rather than a healthy baseline.</p>
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
          Each cell represents a day and hour, colored by its average Z-score in the loaded history. The calendar requests seven days of history; patterns are leads to investigate, not proof that a spike is expected or harmless.
        </p>
        <ul style={UL}>
          <li>Hover any cell in either window size to see its day, hour, average Z-score, and level; empty cells show no data.</li>
          <li>Maximize the window to spread the grid across the available width.</li>
          <li>Use Analyze cards to highlight hours or days, click a legend level to filter the grid, or export a printable PDF.</li>
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
          Open <strong style={{ color: "#fff" }}>Heatmap</strong> on an eligible Follow the Red row for a day × hour calendar scoped to that metric and entity or group, rather than the combined hotness score.
        </p>
        <p style={P}>
          This lets you see exactly which hours and days a specific metric (e.g. Error Rate, or CPU Usage) runs worst — independently of whether other metrics are elevated at the same time. Useful for targeted SLO analysis or capacity planning.
        </p>
        <ul style={UL}>
          <li>Values are shown in the metric's native unit (ms, %, count) on hover</li>
          <li>Color scale uses relative Z-scoring within the metric's own history</li>
          <li>Click Analyze cards to highlight the corresponding hours or days, and use the legend to filter heat levels</li>
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
          Click <strong style={{ color: "#fff" }}>📈 Forecast</strong> above the heat strip to project combined hotness, or use the Forecast pill on an eligible Follow the Red row for a metric or group.
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
        <p style={P}>Hotness Forecast also offers <strong style={{ color: "#fff" }}>Seasonal</strong> (the default), based on historical hourly averages. Choose 7, 14, 30, 60 or 90 days to analyze and a 7, 14 or 30 day forecast, then click Apply. Forecasts are estimates, not guarantees.</p>
        <p style={P}>The Hotness Forecast <strong style={{ color: "#fff" }}>PDF</strong> button opens a printable report with the chart and applied model settings. Apply pending period changes first; export requires sufficient data and is unavailable while loading or on error.</p>
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
          For each metric: set <strong style={{ color: "#fff" }}>Warning</strong> and <strong style={{ color: "#fff" }}>Critical</strong> thresholds. The colored square toggles the metric between Traffic (blue) and Performance (orange). Traffic metrics provide context but can still contribute to heat.
        </p>
        <p style={P}>Under <strong style={{ color: "#fff" }}>Follow the Red — Dimension Split</strong>, configure dimensions and an optional label. An optional <strong style={{ color: "#fff" }}>FTR Link Template</strong> overrides only row-level Open in Dynatrace: use an app-relative path with <code style={CODE}>{"${row}"}</code> for the URL-encoded displayed row name. The current tenant is used; Explore App Path is separate and no timeframe is automatically appended.</p>
        <p style={P}>DQL metrics can also define drill-down, per-row history, and per-row dimension queries. Return the requested fields shown in Settings; the User Guide describes the result shapes and placeholders. Mobile drill details depend on available session data and configured queries.</p>

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
          Add custom personas visible to all users. Each persona has an icon (emoji), label, and description. Built-in personas cannot be removed. Custom personas support their own heat metrics, configurable per-user just like built-in ones.
        </p>
      </div>
    ),
  },
  {
    id: "investigation-links",
    icon: "🔗",
    title: "Investigation Links",
    content: (
      <div style={SECTION_STYLE}>
        <p style={P}>
          Investigation links appear alongside the metric or assessment item that prompted them.
        </p>
        <ul style={UL}>
          <li>Select a heat bucket, then use <strong style={{ color: "#fff" }}>Follow the Red</strong> to investigate an eligible metric.</li>
          <li>Use the adjacent app arrow to open a metric's configured Explore app.</li>
          <li>Expand an assessment item for its available app links and recommendations.</li>
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
          Use <code style={CODE}>{"${from}"}</code>, <code style={CODE}>{"${to}"}</code>, and <code style={CODE}>{"${interval}"}</code> in supported query fields so NavigatorIQ can substitute the active window and interval.
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
          <li><strong style={{ color: "#fff" }}>Red numbers / dots</strong> above bars mark Davis Problems that <em>opened</em> in that interval — use them as investigation leads, not proof of causality</li>
          <li><strong style={{ color: "#fff" }}>Green dots</strong> mark deployment events — a red bar right after a green dot is worth investigating immediately</li>
          <li>Click a bar to see its metric values, or drag across several bars and click <strong style={{ color: "#fff" }}>Zoom in</strong> to investigate the selected range</li>
          <li>The <strong style={{ color: "#fff" }}>Cross-Metric Correlation</strong> table in Hotness Assist tells you which metrics move together — a Rate near 100% means one metric almost always spikes with the other</li>
          <li>Open the <strong style={{ color: "#fff" }}>Hotness Calendar</strong> to compare a spike with recent day-and-hour patterns</li>
          <li>Drag Hotness Assist and Forecast panels to reposition them, or maximize popups for more space</li>
          <li>The <strong style={{ color: "#fff" }}>⟳ refresh button</strong> re-runs all queries without changing the timeframe</li>
          <li>Auto-refresh (Settings → General → 300000 ms) is ideal for incident watch rooms — the heat strip stays live without manual intervention</li>
          <li>Per-user settings mean teammates can have completely different metric configs and thresholds without affecting each other</li>
          <li>Custom personas from Settings → All Users appear for everyone in the tenant — useful for specialized teams or cross-functional squads</li>
          <li>The <strong style={{ color: "#fff" }}>NavigatorIQ Launcher Intelligence</strong> narrative is the fastest way to brief someone mid-incident — it reads like a summary from an analyst, not a raw metric dump</li>
          <li>The <strong style={{ color: "#fff" }}>Automate</strong> button (grid icon) generates a Dynatrace Workflow JSON for a weekly email report — enter an email, download the JSON, upload it to Workflows, and get a Monday 8 AM briefing automatically</li>
          <li><strong style={{ color: "#fff" }}>Drag-to-zoom</strong> can reload a selected range at a finer bucket size (down to 1 minute for short windows) after you click Zoom in.</li>
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
      <PopupWindow style={{ background: "#0f1422", border: "1px solid rgba(69,137,255,0.25)", borderRadius: 14, width: "100%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.85)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "18px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>🧭 NavigatorIQ Launcher — Help Guide</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Everything you need to get the most out of NavigatorIQ Launcher</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a
              href="https://github.com/TechShady/NavigatorIQ/raw/master/USER_GUIDE.docx"
              target="_blank"
              rel="noreferrer"
              title="Download User Guide as Word document"
              style={{ background: "rgba(69,137,255,0.12)", border: "1px solid rgba(69,137,255,0.3)", borderRadius: 8, color: "#7ab4ff", fontSize: 13, padding: "8px 14px", cursor: "pointer", textDecoration: "none", fontWeight: 600 }}
            >
              📄 User Guide
            </a>
            <PopupCloseButton onClick={onClose} style={{ background: "rgba(128,128,128,0.15)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, color: "rgba(255,255,255,0.7)", fontSize: 13, padding: "8px 16px", cursor: "pointer" }}>
              Close
            </PopupCloseButton>
          </div>
        </div>

        {/* Body */}
        <div className="iq-help-layout" style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {/* Nav */}
          <div className="iq-help-nav" style={{ width: 210, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, overflowY: "auto" }}>
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
      </PopupWindow>
    </div>,
    document.body
  );
}
