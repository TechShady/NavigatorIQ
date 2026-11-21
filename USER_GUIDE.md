# NavigatorIQ Launcher — User Guide

> **Version:** 0.4.122 | **Platform:** Dynatrace App Platform | **Type:** Community App (unofficial)

---

## Table of Contents

1. [What Is NavigatorIQ Launcher?](#1-what-is-navigatoriq-launcher)
2. [Getting Started](#2-getting-started)
3. [Choosing Your Persona](#3-choosing-your-persona)
4. [Understanding the Heat Strip](#4-understanding-the-heat-strip)
5. [NavigatorIQ Launcher Intelligence](#5-navigatoriq-launcher-intelligence)
6. [Assessment Panel](#6-assessment-panel)
7. [Bucket Diagnosis — Why Is This Hot?](#7-bucket-diagnosis--why-is-this-hot)
8. [Explore — Metric Drill-Down](#8-explore--metric-drill-down)
9. [Hotness Assist](#9-hotness-assist)
10. [Hotness Calendar](#10-hotness-calendar)
11. [KPI Heatmap](#11-kpi-heatmap)
12. [Forecast](#12-forecast)
13. [Investigation Links](#13-investigation-links)
14. [Automate — Weekly Report Workflow](#14-automate--weekly-report-workflow)
15. [Settings — Personal](#15-settings--personal)
16. [Settings — All Users (Shared)](#16-settings--all-users-shared)
17. [Custom DQL Metrics](#17-custom-dql-metrics)
18. [Best Practices](#18-best-practices)
19. [Incident Response Workflow](#19-incident-response-workflow)
20. [Troubleshooting](#20-troubleshooting)

---

## 1. What Is NavigatorIQ Launcher?

NavigatorIQ Launcher is a **persona-driven operational intelligence dashboard** built on the Dynatrace App Platform. It aggregates the metrics that matter most to a specific role — Developer, SRE, DBA, Security, Network Admin, Digital Experience, K8s, or DevOps — into a single color-coded heat view, and then gets out of the way by launching you directly into the right Dynatrace app to investigate.

### Core philosophy

- **Follow the red.** The heat strip and assessment guide you to what is anomalous right now. You should not need to hunt for problems — NavigatorIQ surfaces them.
- **One click to investigate.** Every metric and every assessment item links directly into the relevant Dynatrace app at the right scope.
- **Your view, your metrics.** Per-user settings mean each person in the team can configure their own thresholds and heat metrics without affecting anyone else.

### What NavigatorIQ is NOT

NavigatorIQ is not a replacement for Dynatrace. It is a **launch pad and triage layer**. It tells you *where* to look. The investigation happens in the full Dynatrace apps.

---

## 2. Getting Started

### First launch

When you open NavigatorIQ for the first time you will see two things:

1. **Disclaimer modal** — confirms this is an unofficial community app. Check *Don't show this again* and click **Continue** if you accept.
2. **Persona Picker** — select the persona that matches your role. You can change this at any time from the header.

The Persona Picker / What's New popup fits within the available viewport and scrolls vertically when its content is taller than the window. Scroll inside the popup to reach all personas and the Continue button; maximizing is optional.

### Maximizing popup windows

Every popup has a **Maximize window** icon beside its close control. Maximizing fills the app viewport in the same tab and enlarges small body text to 16px, with larger headings. Long content remains scrollable. Click **Restore window** to return to the previous size, position, and text sizes without losing selections or edits. Nested popups can be maximized independently. The Disclaimer and Persona Picker have the same maximize control and retain their existing Continue buttons.

PDF export is unchanged and remains available separately in popups that support it.

### The layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Persona chip │ Timeframe tabs │ Refresh │ Settings │ ? │
├─────────────────────────────────────────────────────────────────┤
│  Activity & Spikes (expanded by default)                         │
│    Health summary and Activity Heat Strip                       │
│  Timeframe Assessment (collapsed by default; counts visible)    │
│    Intelligence Narrative and Assessment Items                 │
└─────────────────────────────────────────────────────────────────┘
```

Use either blue section header to expand or collapse that section independently. Critical, warning, healthy, and total assessment counts remain visible in the Timeframe Assessment header even when it is collapsed.

### Timeframe tabs

Select a timeframe in the header to control the data window and heat strip granularity:

| Tab | Window | Bucket Size | Best For |
|-----|--------|-------------|----------|
| Last 2 Hours | Rolling 2h | 5 minutes | Active incident investigation |
| Today | Last 24 hours | 10 minutes | Same-day trend analysis |
| Yesterday | 24h before today | 10 minutes | Comparing today vs yesterday |
| Last 7 Days | Rolling 7 days | 1 hour | Weekly patterns, slow degradation |

> **Tip:** Each tab loads independently. Switching to a tab you have not yet visited triggers fresh queries for that window. Previously visited tabs are cached until you refresh.

### Refreshing data

Click the **⟳** button in the header to re-run all queries without changing the timeframe. For continuous monitoring during incidents, enable auto-refresh in Settings → General.

---

## 3. Choosing Your Persona

NavigatorIQ ships with nine built-in personas. Switch between them using the persona chip in the header.

| Persona | Primary Focus |
|---------|--------------|
| **Developer** | Service error rate, response time, request volume |
| **SRE / Platform** | Host CPU, memory, disk I/O, network, process metrics |
| **DBA** | DB query volume, avg/P99 latency, slow queries, DB errors |
| **Network Admin** | Bytes sent/received, packets, retransmissions |
| **DevOps / CI/CD** | Services, infra, log errors, deployments |
| **Security** | Vulnerability severity, attack events |
| **Digital Experience** | RUM LCP, sessions, Apdex, synthetic failures |
| **Mobile Experience** | Mobile sessions, errors, error-session rate, crash sessions, crash-session rate |
| **K8s** | Container CPU/memory, OOMKills, pod scheduling |

Switching personas instantly updates the heat strip, assessment items, and intelligence narrative for that role.

### Mobile Experience

The built-in **Mobile Experience** persona is available without creating a custom persona. It includes five DQL metrics over mobile `user.sessions`: **Sessions**, **Errors**, **Error Rate**, **Crashes**, and **Crash Rate**. All five include per-app Follow the Red queries, per-row history, and country/operating-system dimension queries.

All five metrics default to **Mobile Navigation**. In Follow the Red, **Open in Dynatrace** passes the selected app name using `my.mobile.navigation.app/?app=${row}`. Mobile Navigation must be installed and accessible in the current tenant. **Error Rate** and **Crash Rate** default to a `%` unit suffix. Existing per-user overrides are kept; users can use the persona's metric reset to restore the built-in defaults.

- **Errors** sums session error counts; **Crashes** counts sessions containing a crash, not individual crash events.
- **Error Rate** and **Crash Rate** are affected-session percentages on a 0-100 scale. Empty time buckets display 0% as a no-traffic convention, not proof of healthy traffic.
- Rate dimensions aggregate affected and total session counts before calculating percentages. Donut size represents session share, separately from the displayed rate.
- Sessions involving multiple frontends contribute to each frontend; session-level errors/crashes are not attributed exclusively to that frontend. Recent data may be incomplete due to session ingestion delay.
- Thresholds are intentionally unset: configure warning and critical levels for your environment under **Settings → Heat Metrics → Mobile Experience**. Sessions is a traffic metric.

Existing custom personas, including any named Mobile Experience, and their saved settings are preserved separately. The built-in persona does not automatically copy or replace them.

### Custom personas

Admins can create custom personas in **Settings → All Users → Custom Personas**. Custom personas are visible to everyone in the tenant and can be configured with their own heat metrics per-user, just like built-in personas.

---

## 4. Understanding the Heat Strip

The heat strip is the central element of NavigatorIQ. It compresses all of your heat metrics into a single color-coded timeline.

### How it works

Each bar in the heat strip represents one time bucket (5 minutes, 10 minutes, or 1 hour depending on the selected timeframe tab). For each bucket, NavigatorIQ computes a **Z-score** for every heat metric — Z-score = how many standard deviations above the mean this bucket is. The highest Z-score across all metrics becomes the bar's color.

This approach makes spikes visible regardless of scale. A 0.5% increase in error rate and a 200ms increase in response time are both surfaced proportionally.

### Color scale

| Color | Level | Threshold | Meaning |
|-------|-------|-----------|---------|
| 🔵 Blue | Normal | Z < 0.75 | At or near average — no action needed |
| 🟡 Yellow | Elevated | Z ≥ 0.75 | Slightly above average — worth watching |
| 🩷 Pink | Warm | Z ≥ 1.5 | Significantly above average — investigate soon |
| 🔴 Red | Spike | Z ≥ 2.5 | Critical anomaly — investigate now |

### Event markers

Markers live in a fixed zone above the bars so tall spikes never cover them:

- 🟢 **Green dot** — a deployment event (GitHub, workflow, or custom deployment) occurred in that interval
- 🔴 **Red number** — how many Davis Problems *opened* during that interval. A `3` means 3 new problems were created in that time bucket. In dense views (Today / 7d with many bars), the number is replaced by a size-scaled red dot so markers don't run together — bigger dot = more problems. Buckets with no new problems show nothing.

These markers let you instantly correlate "something spiked" with "we deployed" or "new problems opened here."

### Interacting with the heat strip

| Action | Result |
|--------|--------|
| Click a bar | Opens **Bucket Diagnosis** for that specific window |
| **Click and drag** across several bars | Highlights the range with a blue outline; releasing **zooms the entire app** into that time window |
| Click **🔥 Hotness Assist** | Opens full timeline analysis panel |
| Click **📅** | Opens **Hotness Calendar** (day × hour heatmap) |
| Click **📈 Forecast** on an assessment item | Opens **Forecast** panel for that metric |

### Drag-to-zoom

When you release a drag-select, NavigatorIQ sets a **custom zoom window** covering the selected bars. A blue banner appears below the header showing the zoomed time range (e.g. `10/7 14:30 → 10/7 16:00`) and the effective bucket size. All queries — heat strip, assessment, narrative, and every panel — reload against this custom window.

Click **✕ Exit zoom** in the banner to return to the full timeframe tab.

> **When to use zoom:** If you see three consecutive red bars in a 7-day view, drag across them to instantly reload all data for that specific window at a finer granularity. Zoom picks the tightest bucket size that fits (down to 1-minute buckets for windows under 30 minutes).

---

## 5. NavigatorIQ Launcher Intelligence

Expand **Timeframe Assessment** below the heat strip for the **NavigatorIQ Launcher Intelligence** narrative, a plain-language summary of the current assessment.

### What the narrative includes

- **Opening context** — how many critical issues were found and over what timeframe
- **Critical items** — each red item gets its own sentence with metric value, trend direction (rising/falling), and an inline recommendation
- **Warning items** — yellow items are grouped: *"Also watching: Error Rate (3.2%), Log Errors (45)"*
- **Traffic note** — if request volume changed by ≥15% from the previous period, a traffic context sentence is added
- **Healthy state** — when everything is green, the narrative confirms the metric values that validated the healthy status

### When it refreshes

The narrative regenerates whenever you:
- Switch timeframe tabs
- Switch personas
- Click the ⟳ refresh button
- Data loads for the first time after opening the app

---

## 6. Assessment Panel

The assessment panel lists every monitored metric for the current persona with a Red / Yellow / Green status badge, the current value, the trend vs the previous period, and a delta percentage.

### Status thresholds

| Status | Meaning |
|--------|---------|
| 🔴 **Critical** | Metric exceeds the critical threshold you have configured |
| 🟡 **Warning** | Metric is between the warning and critical threshold |
| 🟢 **Healthy** | Metric is below the warning threshold |
| ⬜ **No Data** | Query returned no results for this window |

### Assessment actions

Each assessment item has contextual action buttons:

- **↗ Explore** — opens the Explore drill-down panel for that metric
- **📈 Forecast** — opens the Forecast panel projecting that metric forward
- **🗓️ Heatmap** — opens the KPI Heatmap for that metric (day × hour calendar)

---

## 7. Bucket Diagnosis — Why Is This Hot?

Click any bar in the heat strip to open **Bucket Diagnosis** — a draggable, scrollable popup that shows every heat metric's value for that specific time window.

### What you see

- Each metric row shows the raw value, Z-score, and heat color band
- Metrics are sorted by Z-score descending — the worst offenders appear first
- The bucket's start/end time is shown at the top so you can cross-reference in other apps

### Drilling deeper

| Button | Action |
|--------|--------|
| **Follow the Red ↗** on an eligible row | Opens the drill-down panel for that metric within that time window |
| **Why is this hot?** | Narrative explanation of what drove the anomaly in this specific bucket |

> **Best practice:** Use Bucket Diagnosis to narrow from "something spiked at 2pm" to "error rate and response time both spiked — let's look at error rate." Then click Follow the Red on that metric.

---

## 8. Explore — Metric Drill-Down

The **Explore** panel opens from an assessment item or from a row in Bucket Diagnosis. It provides a single-metric deep dive.

### Contents

- **Sparkline** — the metric's full time-series at the current bucket granularity with color-coded bands
- **Entity breakdown** — for supported metrics, a ranked list of the top contributing entities (services, hosts, databases)
- **Diagnosis scenarios** — a set of checks for that metric with CRITICAL / REVIEW / OK status and a recommended action for each
- **Launch button** — opens the relevant Dynatrace app directly (Services, Logs, Infra, etc.) with the current timeframe pre-applied so you land at exactly the right time window

### Digital Experience extras

For Digital Experience metrics, an additional **Dimension** button opens a geo + browser breakdown:
- Pie chart of sessions by country
- Pie chart of sessions by browser
- Export to HTML for sharing in incident reports

### Usability

- The Explore panel is **draggable and resizable** — drag the title bar to reposition, drag the edges/corners to resize
- Multiple Explore panels can be open simultaneously if you open them from different metrics

---

## 9. Hotness Assist

Hotness Assist excludes missing or invalid buckets and buckets where every metric value is zero (for example, zero sessions and zero errors/crashes), regardless of whether a metric is marked as traffic. These buckets cannot become W1/W2 or B1/B2 and do not contribute to comparisons, correlations, trends, next steps, or PDF analysis. Individual zero values remain valid when another metric in the bucket has data; a zero hotness Z-score alone does not exclude a bucket. This is an analysis-only rule; the main heat strip is unchanged. The existing final potentially incomplete bucket is still excluded.

The timeline omits no-data bars while retaining original bucket positions and numbers, so gaps do not shift W1/B1 labels or merge separate spike episodes. A data gap is not treated as recovery. If no eligible buckets remain, the panel reports no data instead of a healthy baseline.

**Hotness Assist** is the deepest analysis view in NavigatorIQ. Open it by clicking **🔥 Hotness Assist** in the heat strip header. The panel is draggable.

### KPI tiles (top row)

| Tile | Meaning |
|------|---------|
| Hot Buckets | Number of time buckets with Z ≥ 0.75 |
| Critical Spikes | Number of buckets with Z ≥ 2.5 |
| Worst Z-Score | The highest Z-score seen in the window |
| Best Z-Score | The lowest Z-score seen in the window |

### Analysis sections

**Hotness Assist Analysis** — animated narrative that describes what happened and when, rendered word-by-word. The first paragraph is a data summary; the second is a root-cause narrative identifying leading indicators and cascade sequences.

**Hotness Timeline** — mini sparkline of the Z-score across the full window. Four bucket markers are labeled directly on the chart:

| Marker | Meaning |
|--------|---------|
| W1 (red) | Worst bucket — peak degradation |
| W2 (pink) | 2nd worst bucket — secondary peak |
| B1 (green) | Best bucket — optimal conditions |
| B2 (light green) | 2nd best bucket — secondary baseline |

**Pattern Analysis** — classifies the degradation shape:
- *Stable* — consistently low heat, no significant spikes
- *Transient* — short spike that resolved quickly
- *Sustained* — elevated heat held for an extended period
- *Chronic* — recurring spikes throughout the window

**Spike Behavior** — episode count, longest consecutive spike run, and average recovery interval between episodes.

**Cross-Metric Correlation** — shows which metric pairs moved together during the window:

| Column | Meaning |
|--------|---------|
| Metric A / Metric B | The pair being compared |
| Co-hot | Number of buckets where both metrics were elevated (Z ≥ 0.75) at the same time |
| Rate | % of Metric A's elevated buckets where Metric B was also elevated |

A **Rate near 100%** means Metric B almost always spikes when Metric A does — strong directional link. Use this to find cascading effects (e.g., Error Rate spikes → Response Time also spikes in 95% of cases).

**What's Different — Worst #1 vs Best #1** — side-by-side metric breakdown comparing W1 (peak degradation) against B1 (optimal conditions), followed by a **Gap Table** showing how much each metric improved between those two buckets. Large gaps indicate high-impact metrics worth investigating.

**Common Bad Signals — Worst #1 vs Worst #2** *(shown when two distinct worst buckets exist)* — compares W1 and W2 side-by-side and highlights metrics elevated in *both* worst windows. Signals persistent across multiple bad periods are your most reliable problem indicators.

**Common Good Signals — Best #1 vs Best #2** *(shown when two distinct best buckets exist)* — compares B1 and B2 and highlights metrics healthy in *both* best windows. These represent your true baseline operating conditions and are the most defensible SLO reference points.

**Insights** — observations derived automatically from metric patterns in the window.

**Recommendations** — prioritized actions based on what the data found.

**Advanced Signals** *(shown when detected)* — deeper signals including:
- *SLO Breach* — estimated minutes of critical-level degradation in the session
- *Cascade* — which metric fired first and which followed, in sequence across buckets
- *Efficiency* — traffic vs performance relationship anomalies

**Next Steps** — Investigate buttons for every metric that exceeded its threshold, linking directly into the relevant Dynatrace app.

**Active Davis Problems** *(shown when present)* — Davis Problems open during the timeframe, listed at the bottom as contextual reference.

---

## 10. Hotness Calendar

Click the **📅** button beside Hotness Assist to open the **Hotness Calendar** — a day-of-week × hour-of-day heatmap that reveals *when* your environment typically runs hot.

### How to read it

- Rows = hours of the day (12am → 11pm)
- Columns = days of the week (Sunday → Saturday)
- Each cell = the average Z-score for that hour and day over the loaded history
- Colors use the same scale as the heat strip
- Hover a cell for its day, hour, average Z-score, and level; empty cells report no data. This works in both the regular and maximized views. Maximize the window to expand the grid across the available width.

### History window

Select **7 days**, **14 days**, or **30 days** of history. The calendar re-queries at each selection.

### Use cases

| Scenario | What you see | Action |
|----------|-------------|--------|
| Monday 9am is always red | Recurring peak — expected | Adjust thresholds or add capacity at that time |
| An unusual red cell at 3am on a Wednesday | Genuinely anomalous | Investigate that specific hour |
| Overnight batch jobs | Red strip from 2–4am every night | Exclude from SLO calculations or separate persona |

> **Key insight:** The Calendar separates *recurring patterns* from *genuine anomalies*. If Monday at 9am is always red, a red bar at 9am on Monday is not an incident. The Calendar tells you this instantly.

The panel is draggable.

---

## 11. KPI Heatmap

Each assessment item has a **🗓️** button that opens a **KPI Heatmap** — a day × hour calendar scoped to that single metric, showing its raw value (not Z-score) in each cell.

### Difference from Hotness Calendar

| | Hotness Calendar | KPI Heatmap |
|-|-----------------|-------------|
| Scope | All metrics combined (Z-score) | One metric (raw value) |
| Scale | Relative Z-score | Metric's native unit (ms, %, count) |
| Use | When does the environment get hot overall? | When does *this specific metric* spike? |

### Features

- Hover any cell to see the exact raw value and hour range
- Best and worst hour/day are highlighted with a ring indicator
- Color scale uses relative Z-scoring within the metric's own history, so low-variance metrics still show variation
- **Clickable insight cards** — the Analyze section shows insight cards (Hot Zone, Worst Hour, Worst Day, Best Hour, Best Day). Click a card to highlight the corresponding rows or columns in the heatmap grid. Click the card again (or the legend's Clear button) to remove the highlight.
- **Legend filter** — click any color band in the legend to dim cells outside that heat level, isolating only the cells you care about

### Use cases

- CPU usage: identify which hours approach capacity
- Error rate: confirm whether errors are business-hours-only or 24/7
- DB query latency: spot batch job windows that slow down query response times

---

## 12. Forecast

Open the **Forecast** panel from an assessment item's **📈** button. It projects a metric's trend forward using statistical models.

### Available models

| Model | Best For |
|-------|---------|
| **Linear** | Steadily trending metrics (memory leak, disk fill rate) |
| **Holt-Winters** | Metrics that accelerate or decelerate (adapts level + trend) |
| **Triple Exponential** | Metrics with repeating daily/weekly patterns |
| **Prophet** | Metrics with sudden baseline shifts or irregular changepoints |
| **ARIMA** | General-purpose stationary time series |
| **SARIMA** | Strong, consistent seasonal patterns |

### Reading the chart

- **Solid line** — historical data (current timeframe window)
- **Dashed line** — forecast projected forward
- **Shaded band** — confidence interval (wider = less certain)

### Selecting a model

Try multiple models and pick the one whose historical fit (how well it tracks the solid line) is best. A model that tracks history well is more likely to forecast accurately.

The panel is draggable. Extend the forecast horizon using the control at the top of the panel.

The **Forecast** button above the activity heat strip opens Hotness Forecast for the combined hotness score. Its **PDF** button opens a printable report with the chart, applied model and periods, confidence, and forecast peak. Apply any pending period changes before exporting.

---

## 13. Investigation Links

Select a heat bucket and use **Follow the Red** on an eligible metric to investigate its contributors. The adjacent app arrow opens the metric's configured Explore app. Expand an assessment item to see its recommendations and available links to relevant Dynatrace apps.

---

## 14. Automate — Weekly Report Workflow

The **Automate** button (grid icon, ⠿) in the header generates a ready-to-import Dynatrace Workflow that sends a weekly metric report for the current persona.

### What it does

The generated workflow runs **every Monday at 8:00 AM** and:

1. Queries each of the persona's heat metrics over the last 7 days using DQL
2. Sends each metric's data to Dynatrace Intelligence for a 2–3 sentence health summary
3. Compiles all per-metric summaries into an overall executive report (Executive Summary, Key Findings, Trends, Recommendations)
4. Emails the finished report to the address you specify

### How to use it

1. Click the **Automate** button (grid icon) in the header
2. Enter the email address that should receive the weekly report
3. Click **↓ Download Workflow JSON** — a `.workflow.json` file is saved to your downloads
4. Open the **Workflows** app in Dynatrace
5. Click **Upload** (top-right) and select the downloaded file
6. The workflow activates immediately and will run every Monday at 8:00 AM Eastern

### Notes

- The workflow name is `NavigatorIQ <Persona> Weekly Report` and is created as a private workflow owned by whoever uploads it
- Each persona generates its own workflow — you can have separate workflows for Developer, SRE, DBA, etc.
- The workflow uses the persona's currently configured heat metrics at the time you download it; re-download if you change your metric configuration
- You need the **Dynatrace Intelligence (Davis Copilot)** and **Workflows** apps available in your tenant

---

## 15. Settings — Personal

Personal settings are saved to your Dynatrace user state. They are private to you and do not affect other users. Open with the **⚙️** button in the header.

### Assessment Thresholds

Numeric warning and critical thresholds for each assessment metric. These determine when a metric shows Yellow or Red status. Adjust to match your environment's SLOs:
- An environment with a strict 99.9% SLA should use a lower error rate critical threshold than a dev environment
- Response time thresholds should reflect your users' actual experience expectations

### Hotness Metrics

Configure what data drives the heat strip for each persona. Three metric types are available:

**Single metric** — one Dynatrace metric key with an aggregation:
```
Metric key: dt.host.cpu.usage
Aggregation: avg
Unit: %
```

**Ratio (A ÷ B)** — divides two metrics to compute a rate or percentage:
```
Numerator: dt.service.request.failure_count
Denominator: dt.service.request.count
Result: error rate %
```

**Custom DQL** — any DQL query returning a `value` column per time bucket:
```dql
fetch spans, from:${from}, to:${to}
| filter isNotNull(db.system)
| makeTimeseries value=count(), interval:${interval}
```

For each metric, configure:
- **Warning threshold** and **Critical threshold** (leave empty for traffic metrics where high values are normal)
- **Traffic / Performance toggle** — Traffic (blue) = high values are expected; Performance (orange) = high values are bad
- **Display unit** — how values are shown in the UI (ms, %, count, etc.)
- **Follow the Red — Dimension Split** — configure how data is broken down when you drill into this metric

### Follow the Red — Dimension Split

Select a heat bucket, then click **Follow the Red ↗** next to an eligible metric in Bucket Diagnosis. NavigatorIQ opens a drill-down view showing which entities (services, hosts, frontend apps, etc.) are driving the metric anomaly. The **Dimension Split** configuration controls how the data is grouped in that drill-down.

#### Configuring dimensions

For each metric, specify the dimension(s) to group by:

**Example 1: Single dimension**
```
Dimensions: entityName(dt.entity.service)
Label: by Service
```
This groups error counts by service name in the drill-down view.

**Example 2: Multiple dimensions**
```
Dimensions: frontend.name, page.name
Label: by App & Page
```
This groups frontend metrics by application name and page name, showing which app and page combination has the worst performance.

**Example 3: Custom entity fields**
```
Dimensions: entityName(dt.entity.host), host.os
Label: by Host & OS
```
Groups by host name and operating system.

#### Dimension presets

For common metrics, NavigatorIQ includes pre-configured dimension splits. When you edit a metric with a known metric key (e.g., `dt.service.request.failure_count`), preset buttons appear below the Dimensions field. Click a preset to instantly apply its dimension configuration.

#### How dimensions affect drill-down

- When you open the **Follow the Red** modal for a metric, the query groups data by your configured dimensions
- Each row in the drill-down table represents one combination of your selected dimensions
- **Top entities** are sorted by the metric value, so you see the most impactful groups first
- Clicking a row may open additional diagnostic panels depending on the metric type

#### Dynamic FTR app links

Each metric has an optional **FTR Link Template** under **Settings → Heat Metrics → Follow the Red — Dimension Split**. This changes only the **Open in Dynatrace** button on Follow the Red rows, for both standard metric and DQL breakdowns. It does not change **Explore App Path** or Investigate/Next Steps navigation.

For example:

```text
my.mobile.navigation.app/?app=${row}
```

For a row named `L1158_mobile`, this opens `/ui/apps/my.mobile.navigation.app/?app=L1158_mobile` in the current tenant and a new tab. `${row}` is the row's displayed name, URL-encoded automatically; it is not a DQL string literal and needs no surrounding quotes. Repeated `${row}` placeholders and subroutes are supported. A multi-dimension row passes its displayed name, not a separately inferred app name or entity ID.

Use an app-relative path, without a hostname or leading slash. `${row}` is required and is the only supported placeholder. The link opens exactly the configured route and parameters; a timeframe is not appended automatically. Invalid templates and missing row names show an error instead of opening a fallback destination. The receiving app must support the supplied parameter (for example, `app`).

Leave the template blank to preserve existing FTR link behavior. Generic custom DQL rows that previously had no Open in Dynatrace button gain one when a template is configured.

#### Custom DQL drill-downs

The mobile session-count query shown below supports an automatic breakdown when Dimensions is set to `frontend.name`:

```dql
fetch user.sessions, from:${from}, to:${to}
| filter dt.rum.application.type == "mobile"
| makeTimeseries value=count(), interval:${interval}, time:start_time
```

For other custom DQL metrics, enter a **Drill-down DQL** query that returns one row per group with a text `displayName` and numeric `value`. The `${from}`, `${to}`, and `${interval}` placeholders use the selected timeframe and bucket interval. For example:

```dql
fetch user.sessions, from:${from}, to:${to}
| filter dt.rum.application.type == "mobile"
| expand frontend.name
| filter isNotNull(frontend.name)
| summarize value=count(), by:{displayName=frontend.name}
| sort value desc
```

The custom query defines its own grouping; the Dimensions field does not modify it. Results cover the selected timeframe, not just the clicked heat bucket. A session involving multiple frontends is counted for each frontend.

The automatic mobile session breakdown includes drill pills for each frontend. Baseline, Anomaly, and Heatmap use seven days of hourly session starts ending at or before the selected timeframe end; Forecast offers selectable analysis periods, intervals, horizons, and methods. The latest two hours are excluded to allow for session ingestion delay. Heatmap colors compare volume to the series average, not health. Diagnose and Impact show session-level crash and error counts, and Dimension shows country and OS counts for the selected timeframe. Session-level errors can include other frontends involved in the same session. Cost Impact is unavailable without business data. Open in Dynatrace opens Digital Experience without selecting the frontend.

The following mobile error metric and its matching drill-down query also support pills for each error type:

```dql
timeseries value = sum(dt.frontend.error.count),
  filter: frontend.name == "YOUR_MOBILE_FRONTEND",
  from: ${from},
  to: ${to},
  interval: ${interval}
```

```dql
timeseries value = sum(dt.frontend.error.count, scalar: true),
  by: {frontend.name, error.type},
  filter: frontend.name == "YOUR_MOBILE_FRONTEND",
  from: ${from},
  to: ${to}
| fields displayName = concat(frontend.name, " / ", coalesce(error.type, "Unknown")), value
| sort value desc
```

Replace `YOUR_MOBILE_FRONTEND` with the same frontend name in both queries. Forecast, Baseline, Anomaly, and Heatmap use metric counts for the selected error type. Diagnose, Impact, and Dimension use error events for that frontend and type, so their counts can differ from metric counts; distinct session and instance counts are estimates. Open in Dynatrace opens Errors without selecting the frontend. Cost Impact remains unavailable without business data.

Other custom DQL breakdowns also show drill pills. To enable their history-based panels, configure **Per-row history DQL** with all four placeholders `${row}`, `${from}`, `${to}`, and `${interval}`. `${row}` is substituted as a quoted DQL string containing the selected `displayName`. Return exactly one timeseries record with a numeric `value` array and `timeframe`, covering the requested interval without missing or negative values; use an explicit zero default only when zero is correct. The history query must select the same group and measure as the drill-down row. For example, with the session breakdown above:

```dql
fetch user.sessions, from:${from}, to:${to}
| filter dt.rum.application.type == "mobile"
| expand frontend.name
| filter frontend.name == ${row}
| makeTimeseries value=count(default:0), interval:${interval}, time:start_time, from:toTimestamp(${from}), to:toTimestamp(${to})
```

For **Dimension**, optionally configure **Per-row dimension DQL** using `${row}`, `${from}`, and `${to}`. Return two dimension fields aliased as `country` and `os`, and a non-negative numeric `value` for each combination; values must be additive counts or weights, not averages or percentages. Set the two dimension labels if they are not country and operating system. For example:

```dql
fetch user.sessions, from:${from}, to:${to}
| filter dt.rum.application.type == "mobile"
| expand frontend.name
| filter frontend.name == ${row}
| summarize value=count(), by:{country=geo.country.name, os=os.name}
```

Without these queries, the corresponding panels explain what is missing. **Diagnose** combines hourly history with the leading segments in the selected timeframe when a dimension query is available. **Baseline** shows the prior hourly distribution and a three-standard-deviation review band. **Anomaly** compares the latest complete hour with that band; this is a statistical review signal, not a confirmed incident.

For built-in Mobile Experience metrics, **Impact** shows recorded sessions with errors or crashes and the telemetry coverage for each count. These rates are calculated from sessions that report the relevant field and can differ from the metric rate. Generic DQL without affected-session telemetry does not estimate impact. Cost Impact is unavailable without business data. The app does not infer a Dynatrace destination for arbitrary DQL.

##### Session error and crash percentages

Session error rate is the percentage of sessions with `error.count > 0`; session crash rate is the percentage with `error.has_crash == true`. These are affected-session percentages, not error events per session or per minute.

For percentage metrics, set Display Unit to Percent (`pct`), keep higher values as worse, and return values on the 0-100 scale. A main error-rate query can average a per-session 0/100 indicator:

```dql
fetch user.sessions, from:${from}, to:${to}
| filter dt.rum.application.type == "mobile"
| fieldsAdd sessionRate=if(coalesce(error.count, 0) > 0, 100.0, else:0.0)
| makeTimeseries value=avg(sessionRate, default:0),
    interval:${interval}, time:start_time,
    from:toTimestamp(${from}), to:toTimestamp(${to}), nonempty:true
```

For crash rate, use `if(coalesce(error.has_crash, false), 100.0, else:0.0)` instead. The explicit `default:0` treats no-session buckets as 0% for display/history completeness, not as evidence of healthy traffic. Omit that convention if an undefined rate is required, but history panels reject missing buckets. Recent session data can be incomplete because of ingestion delay.

The drill-down query must average the same indicator per frontend, not add percentages:

```dql
fetch user.sessions, from:${from}, to:${to}
| filter dt.rum.application.type == "mobile"
| expand frontend.name
| filter isNotNull(frontend.name)
| fieldsAdd sessionRate=if(coalesce(error.count, 0) > 0, 100.0, else:0.0)
| summarize value=avg(sessionRate), by:{displayName=frontend.name}
| sort value desc
```

For per-row history, add `expand frontend.name` and `filter frontend.name == ${row}` before `fieldsAdd` in the main query. For crash-rate drill-down/history, replace the indicator as described above.

For **Per-row dimension DQL**, session percentage queries return `country`, `os`, `numerator` (affected sessions), and `denominator` (all sessions), instead of an already-divided `value`:

```dql
fetch user.sessions, from:${from}, to:${to}
| filter dt.rum.application.type == "mobile"
| expand frontend.name
| filter frontend.name == ${row}
| summarize numerator=countIf(error.count > 0), denominator=count(),
    by:{country=geo.country.name, os=os.name}
| fieldsAdd numerator=toDouble(numerator), denominator=toDouble(denominator)
```

For crashes, replace `countIf(error.count > 0)` with `countIf(error.has_crash == true)`. Counts must be numeric, non-negative, and satisfy `numerator <= denominator` in every record. Do not mix count-only and rate records. The app sums numerators and denominators separately for each country/OS, then calculates `100 * numerator / denominator`; it never sums or averages precomputed percentages. Zero-denominator groups are omitted. The legend shows **Rate** and **Session share** separately: donut sizes represent all-session share, not rate. Hover shows affected/total counts; PDF export includes counts and rate.

### General

| Setting | Description |
|---------|-------------|
| Default Persona | Which persona loads when you open the app |
| Auto-Refresh Interval | How often queries re-run (ms). 0 = manual only. 300000 = every 5 minutes |

---

## 16. Settings — All Users (Shared)

Shared settings are visible to everyone in the tenant. Only configure things here that you want all users to see.

### Custom Personas

Add a persona visible to all users:
- **Icon** — an emoji that appears in the persona picker
- **Label** — the persona name
- **Description** — shown in the persona picker to explain who this persona is for

Once created, each user can independently configure heat metrics, thresholds, and **dimension splits** for a custom persona in their Personal settings.

#### Setting up dimensions for custom personas

When you create a custom persona (e.g., "Mobile", "Payment Services", "Data Platform"), each user can define how metrics should be grouped in drill-down views:

**Example: Mobile Persona with app-specific dimensions**

A Platform Engineer creates a "📱 Mobile" custom persona shared with the team. Users then configure metrics like this in their Personal settings for the Mobile persona:

```
Metric: Error Count
Metric key: dt.frontend.error.count
Dimensions: app.name, device.type
Label: by App & Device Type
```

This allows each team member to see which mobile app and device combination has the highest error rate when they drill into Error Count.

**Benefits of customizable dimensions:**
- **Role-specific insights** — different roles care about different groupings
- **Data model flexibility** — dimensions adapt to your app's entity model and structure
- **Fast problem identification** — group by what matters to your team (e.g., service name vs. handler; region vs. zone; app vs. screen)

---

## 17. Custom DQL Metrics

Custom DQL metrics are the most powerful way to extend NavigatorIQ to any data in your environment.

### Requirements

Your DQL query must return one row per time bucket with a column named `value`. Use `makeTimeseries` for time-bucketed data:

```dql
fetch spans, from:${from}, to:${to}
| filter isNotNull(db.system)
| makeTimeseries value=count(), interval:${interval}
```

### Available placeholders

| Placeholder | Replaced with |
|------------|--------------|
| `${from}` | Start of the selected timeframe (e.g., `now()-2h`) |
| `${to}` | End of the selected timeframe (e.g., `now()`) |
| `${interval}` | Bucket size for the current tab (e.g., `5m`, `10m`, `1h`) |

> **Important:** `now()` is only valid in `from:` and `to:` parameters on the `fetch` line. It is **not** valid inside a pipeline stage. Always use `${from}` and `${to}` placeholders — NavigatorIQ substitutes them with absolute timestamps automatically.

### Validated DQL patterns

**Database call volume** (any database, any framework):
```dql
fetch spans, from:${from}, to:${to}
| filter isNotNull(db.system)
| makeTimeseries value=count(), interval:${interval}
```

**Log errors over time:**
```dql
fetch logs, from:${from}, to:${to}
| filter status == "ERROR" or status == "FATAL"
| makeTimeseries value=count(), interval:${interval}
```

**Active Davis Problems count:**
```dql
fetch dt.davis.problems, from:${from}, to:${to}
| filter event.status == "ACTIVE"
| summarize value=count()
```

**RUM conversion funnel step:**
```dql
fetch user.events, from:${from}, to:${to}
| fieldsAdd slot = bin(start_time, ${interval})
| summarize steps=collectDistinct(view.name), by:{dt.rum.session.id, slot}
| summarize total=countIf(iAny(steps[] == "/checkout")), by:{slot}
| fieldsAdd value=toDouble(total)
```

### Key field name reference

| Data | Correct field | Common mistake |
|------|--------------|----------------|
| Davis Problems table | `fetch dt.davis.problems` | `fetch events \| filter event.type == "DAVIS_PROBLEM"` |
| Problem status | `event.status == "ACTIVE"` | `event.status == "OPEN"` |
| Problem name | `event.name` | `event.title` |
| Log severity | `status == "ERROR"` | `log.level == "ERROR"` |

---

## 18. Best Practices

### Timeframe selection

- **Use Last 2 Hours** for active incident investigation. Five-minute buckets give you the granularity to pinpoint exactly when things went wrong.
- **Use Last 7 Days** to identify slow-moving degradation — memory leaks, disk fill rates, gradual latency increases that are invisible at 2-hour scale.
- **Use Yesterday + Today** side by side (switch tabs) to compare today's pattern against the prior day. A spike that also happened yesterday at the same time is likely a scheduled job, not an incident.

### Heat strip interpretation

- A single red bar does not always mean an incident. Check whether the same bar appears red in the Hotness Calendar — if Monday at 9am is always red, it is an expected peak.
- **Green dot + red bar** immediately following: strongly suggests a deployment caused the spike. Click the red bar to open Bucket Diagnosis, then click Explore on the worst metric to see which services are affected.
- **Red marker + red bar**: Davis opened one or more problems during that interval. In sparse views the count shows as a number; in dense views it shows as a size-scaled red dot. A high count alongside a spike is a strong signal that something systemic broke. NavigatorIQ shows you *when* it started and how it correlates with metrics — open the Problems app for full detail.

### Assessment thresholds

- Start with the defaults and adjust after running the app for a week in your environment. You will quickly learn whether your default error rate sits at 0.5% (lower the critical threshold) or 8% (raise it).
- Use **Traffic** type for metrics where high values are expected during busy periods (request volume, DB query count). NavigatorIQ will not penalize heat scores for high traffic metrics.
- Set thresholds conservatively for critical production environments and more liberally for staging or dev environments — consider creating separate custom personas for each.

### Hotness Assist workflow

1. Open Hotness Assist when you want context beyond "something spiked."
2. Check **Pattern Analysis** first — Transient vs Sustained tells you whether the incident is ongoing.
3. Look at **What's Different — W1 vs B1** to see which metrics were worst at peak.
4. If W2 exists, check **Common Bad Signals** — metrics elevated in both worst windows are your strongest leads.
5. Use the **Cross-Metric Correlation** table to find cascading effects. If Error Rate drives Response Time (Rate = 95%), fixing errors will likely fix latency too.
6. Use **Next Steps** to launch directly into the right Dynatrace app.

### Custom personas for teams

If you support multiple teams with different concerns, create a custom persona per team in Settings → All Users. Each team member can then select their team persona as default. Custom personas can cover any Dynatrace metric via DQL — there is no limit to what you can surface.

### Auto-refresh for war rooms

During major incidents, set auto-refresh to 300000ms (5 minutes) in Settings → General. The heat strip will stay live without manual intervention, so the room can focus on investigation rather than refreshing the dashboard.

---

## 19. Incident Response Workflow

This is the recommended flow for using NavigatorIQ during an active incident.

### Step 1 — Triage with the heat strip

1. Open **Last 2 Hours**
2. Look at the heat strip — identify the red bars
3. Note whether green (deployment) or red (Davis Problem) markers are present

### Step 2 — Identify the pattern

4. Click **🔥 Hotness Assist**
5. Check **Pattern Analysis** — is this Transient (resolved) or Sustained (still ongoing)?
6. Check **Active Davis Problems** at the bottom — is there already an open problem? If yes, coordinate with whoever owns it.

### Step 3 — Find the root metric

7. Look at **What's Different — W1 vs B1** in Hotness Assist — which metrics were highest at peak?
8. If a second worst bucket exists, check **Common Bad Signals (W1 vs W2)** — metrics elevated in both are your strongest leads.
9. Check the **Cross-Metric Correlation** table — which metrics are strongly linked?
10. The metric with the highest Z-score and the strongest correlations is your primary suspect.

### Step 4 — Drill down

11. Click **Explore** on the primary suspect metric
12. Review the entity breakdown — which services/hosts are driving the value?
13. Review diagnosis scenarios — what specific conditions are flagged?
14. Click the **Launch** button to open the full Dynatrace app at the right scope

### Step 5 — Validate the fix

15. After a remediation action (restart, config change, rollback), return to NavigatorIQ
16. Hit **⟳ Refresh** to re-run queries
17. Watch the heat strip — bars should start trending blue/yellow
18. If a deployment caused the incident, verify the new green dot appears and subsequent bars cool down

### Step 6 — Post-incident review

19. Switch to **Last 7 Days** to see the spike in weekly context
20. Open **Hotness Calendar** — was this hour/day pattern normal or truly anomalous?
21. Review thresholds — was the alert threshold appropriate, or does it need tuning?

---

## 20. Troubleshooting

### The app shows "No Data" for all metrics

- Verify you have the correct Dynatrace permissions for the data you are querying (metrics, logs, spans, etc.)
- Check the timeframe — if you select Yesterday on a freshly provisioned environment, there may genuinely be no data
- For custom DQL metrics, test the query directly in the Dynatrace DQL editor to confirm it returns results

### Heat strip is all blue even though I know there are problems

- Check your **Hotness Metrics** configuration in Settings → Personal. If the metrics configured for your persona are not the ones that spiked, the heat strip will not show them.
- Check your **Assessment Thresholds** — they may be set too high for your environment (e.g., a Critical threshold of 50% error rate will not turn red for a 5% error rate).
- The Z-score model compares each bucket against the window's own mean. If the *entire* window was degraded, all buckets look "normal" relative to each other. Switch to Last 7 Days to get a broader baseline.

### Davis Problem markers are not appearing

- Davis Problems are queried from `fetch dt.davis.problems` with `event.status == "ACTIVE"`. Confirm there are active problems in your environment's Problems app.
- The markers show problems that *opened* within each bucket. A problem that started before the current timeframe window will not show a marker even if it is still active — switch to a wider timeframe to see when it opened.
- In dense views (Today / 7d), markers appear as size-scaled red dots rather than numbers. A dot is still shown even when small.

### The "NavigatorIQ failed to load" screen appears

- Click **Clear cache & retry** — this clears the browser session state and reloads
- If the error persists, copy the red error message shown on screen and share it with the app owner
- If you are a first-time user and see this immediately: ensure you have been granted access to the NavigatorIQ app in the Dynatrace tenant

### The app is very slow to load

- NavigatorIQ runs a large number of DQL queries in parallel at startup. On the first load of each timeframe tab, expect 5–15 seconds for all queries to complete.
- If you have many custom DQL metrics with complex queries, startup will be slower. Consider simplifying heavy queries or reducing the number of metrics per persona.
- Auto-refresh at a very short interval (e.g., 60 seconds) with many metrics can cause continuous loading. Use 300000ms (5 min) or longer.

### My settings were lost

- Settings are saved to Dynatrace user state. If you clear browser storage, your settings remain on the server and will reload on the next visit.
- If you switched to a different Dynatrace tenant (different environment URL), your settings are tenant-scoped and will not carry over.

---

## Appendix — Personas Quick Reference

| Persona | Default Heat Metrics |
|---------|---------------------|
| Developer | Request Volume, Error Rate, Response Time |
| SRE / Platform | CPU, Memory, Disk Usage/I/O, Network |
| DBA | DB Query Volume, Avg Latency, P99 Latency, Slow Queries, DB Errors |
| Network Admin | Bytes Sent/Received, Packets Sent/Received, Retransmissions |
| DevOps / CI/CD | Request Volume, Error Rate, CPU, Memory, Log Errors |
| Security | Vulnerability Severity, Attack Events |
| Digital Experience | RUM LCP, Sessions, Apdex, Synthetic Failures |
| K8s | Container CPU, Container Memory, OOMKills |

---

*NavigatorIQ Launcher is an unofficial community application. It is not supported by Dynatrace. Report issues or request features at [github.com/TechShady/NavigatorIQ](https://github.com/TechShady/NavigatorIQ).*
