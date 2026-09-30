# NavigatorIQ Launcher — User Guide

> **Version:** 0.4.75 | **Platform:** Dynatrace App Platform | **Type:** Community App (unofficial)

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
13. [App Links Panel](#13-app-links-panel)
14. [Settings — Personal](#14-settings--personal)
15. [Settings — All Users (Shared)](#15-settings--all-users-shared)
16. [Custom DQL Metrics](#16-custom-dql-metrics)
17. [Best Practices](#17-best-practices)
18. [Incident Response Workflow](#18-incident-response-workflow)
19. [Troubleshooting](#19-troubleshooting)

---

## 1. What Is NavigatorIQ Launcher?

NavigatorIQ Launcher is a **persona-driven operational intelligence dashboard** built on the Dynatrace App Platform. It aggregates the metrics that matter most to a specific role — Developer, SRE, DBA, Security, Network Admin, Digital Experience, K8s, or DevOps — into a single color-coded heat view, and then gets out of the way by launching you directly into the right Dynatrace app to investigate.

### Core philosophy

- **Follow the red.** The heat strip and assessment guide you to what is anomalous right now. You should not need to hunt for problems — NavigatorIQ surfaces them.
- **One click to investigate.** Every metric and every assessment item links directly into the relevant Dynatrace app at the right scope.
- **Your view, your metrics.** Per-user settings mean each person in the team can configure their own thresholds, heat metrics, and app links without affecting anyone else.

### What NavigatorIQ is NOT

NavigatorIQ is not a replacement for Dynatrace. It is a **launch pad and triage layer**. It tells you *where* to look. The investigation happens in the full Dynatrace apps.

---

## 2. Getting Started

### First launch

When you open NavigatorIQ for the first time you will see two things:

1. **Disclaimer modal** — confirms this is an unofficial community app. Check *Don't show this again* and click **Continue** if you accept.
2. **Persona Picker** — select the persona that matches your role. You can change this at any time from the header.

### The layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Persona chip │ Timeframe tabs │ Refresh │ Settings │ ? │
├──────────────────────────────────────────┬──────────────────────┤
│                                          │                      │
│  Activity Heat Strip                     │  App Links Panel     │
│  Intelligence Narrative                  │  (quick-launch       │
│  Assessment Items (Red / Yellow / Green) │   sidebar)           │
│                                          │                      │
└──────────────────────────────────────────┴──────────────────────┘
```

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

NavigatorIQ ships with eight built-in personas. Switch between them using the persona chip in the header.

| Persona | Primary Focus |
|---------|--------------|
| **Developer** | Service error rate, response time, request volume |
| **SRE / Platform** | Host CPU, memory, disk I/O, network, process metrics |
| **DBA** | DB query volume, avg/P99 latency, slow queries, DB errors |
| **Network Admin** | Bytes sent/received, packets, retransmissions |
| **DevOps / CI/CD** | Services, infra, log errors, deployments |
| **Security** | Vulnerability severity, attack events |
| **Digital Experience** | RUM LCP, sessions, Apdex, synthetic failures |
| **K8s** | Container CPU/memory, OOMKills, pod scheduling |

Switching personas instantly updates the heat strip, assessment items, intelligence narrative, and app links sidebar — everything reconfigures for that role.

### Custom personas

Admins can create custom personas in **Settings → All Users → Custom Personas**. Custom personas are visible to everyone in the tenant and can be configured with their own heat metrics and app links per-user, just like built-in personas.

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
| **Click and drag** across several bars | Highlights the range in blue; releasing opens **Bucket Diagnosis** for the hottest bucket in the selected range |
| Click **🔥 Hotness Assist** | Opens full timeline analysis panel |
| Click **📅** | Opens **Hotness Calendar** (day × hour heatmap) |
| Click **📈 Forecast** on an assessment item | Opens **Forecast** panel for that metric |

> **Drag-select tip:** Use drag-select to zoom into a suspicious window. For example, if you see three consecutive red bars in a 7-day view, drag across them to immediately open diagnosis for the worst moment in that period.

---

## 5. NavigatorIQ Launcher Intelligence

Below the heat strip, the **NavigatorIQ Launcher Intelligence** section generates a plain-language narrative of the current assessment. The text prints word by word — like a response from an AI assistant — so you can read it as it builds rather than waiting for a wall of text.

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
| **↗ Explore** on a row | Opens the Explore panel for that metric within that time window |
| **Why is this hot?** | Narrative explanation of what drove the anomaly in this specific bucket |

> **Best practice:** Use Bucket Diagnosis to narrow from "something spiked at 2pm" to "error rate and response time both spiked — let's look at error rate." Then click Explore on that metric.

---

## 8. Explore — Metric Drill-Down

The **Explore** panel opens from an assessment item or from a row in Bucket Diagnosis. It provides a single-metric deep dive.

### Contents

- **Sparkline** — the metric's full time-series at the current bucket granularity with color-coded bands
- **Entity breakdown** — for supported metrics, a ranked list of the top contributing entities (services, hosts, databases)
- **Diagnosis scenarios** — a set of checks for that metric with CRITICAL / REVIEW / OK status and a recommended action for each
- **Launch button** — opens the relevant Dynatrace app directly (Services, Logs, Infra, etc.)

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

**Hotness Assist** is the deepest analysis view in NavigatorIQ. Open it by clicking **🔥 Hotness Assist** in the heat strip header. The panel is draggable.

### KPI tiles (top row)

| Tile | Meaning |
|------|---------|
| Hot Buckets | Number of time buckets with Z ≥ 0.75 |
| Critical Spikes | Number of buckets with Z ≥ 2.5 |
| Worst Z-Score | The highest Z-score seen in the window |
| Best Z-Score | The lowest Z-score seen in the window |

### Analysis sections

**Hotness Timeline** — mini sparkline of the Z-score across the full window, with worst and best bucket markers (▼ / ▲).

**Activity Pattern** — classifies the degradation shape:
- *Stable* — consistently low heat, no significant spikes
- *Transient* — short spike that resolved quickly
- *Sustained* — elevated heat held for an extended period
- *Chronic* — recurring spikes throughout the window

**Worst vs Best Buckets** — side-by-side metric breakdown comparing the single hottest and coolest time buckets. This isolates exactly which metrics were elevated at peak degradation.

**Gap Table** — for each metric, how much it improved from the worst bucket to the best bucket. Large gaps indicate high-impact metrics worth focusing on.

**Cross-Metric Correlation** — shows which metric pairs moved together during the window:

| Column | Meaning |
|--------|---------|
| Metric A / Metric B | The pair being compared |
| Co-hot | Number of buckets where both metrics were elevated (Z ≥ 0.75) at the same time |
| Rate | % of Metric A's elevated buckets where Metric B was also elevated |

A **Rate near 100%** means Metric B almost always spikes when Metric A does — strong directional link. Use this to find cascading effects (e.g., Error Rate spikes → Response Time also spikes in 95% of cases).

**Insights & Recommendations** — observations derived automatically from metric patterns in the window.

**Davis Problems** — any active Davis Problems during the timeframe, with their names listed.

**Next Steps** — a list of Investigate buttons for every metric that exceeded its threshold, linking directly into the relevant Dynatrace app.

---

## 10. Hotness Calendar

Click the **📅** button beside Hotness Assist to open the **Hotness Calendar** — a day-of-week × hour-of-day heatmap that reveals *when* your environment typically runs hot.

### How to read it

- Rows = hours of the day (12am → 11pm)
- Columns = days of the week (Sunday → Saturday)
- Each cell = the worst Z-score seen during that hour slot, aggregated across the selected history window
- Colors use the same scale as the heat strip

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

---

## 13. App Links Panel

The right-hand sidebar shows quick-launch buttons for Dynatrace apps relevant to the current persona.

| Element | Meaning |
|---------|---------|
| 🟢 Green dot | App is marked as installed |
| ⚫ Grey dot | App not yet installed (still clickable — goes to app catalog) |
| App name button | Opens the app in Dynatrace |
| **Docs** link | Opens the app's documentation |

Configure which apps appear and in what order in **Settings → Personal → App Links**.

---

## 14. Settings — Personal

Personal settings are saved to your Dynatrace user state. They are private to you and do not affect other users. Open with the **⚙️** button in the header.

### App Links

Configure the apps that appear in the sidebar for each persona:
- **Label** — display name shown in the sidebar
- **App Path** — the Dynatrace app identifier (e.g., `dynatrace.services`, `dynatrace.infraops`)
- **Docs URL** — optional documentation link
- **Visibility toggle** — colored dot toggles the app on/off without deleting it

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

### General

| Setting | Description |
|---------|-------------|
| Default Persona | Which persona loads when you open the app |
| Auto-Refresh Interval | How often queries re-run (ms). 0 = manual only. 300000 = every 5 minutes |

---

## 15. Settings — All Users (Shared)

Shared settings are visible to everyone in the tenant. Only configure things here that you want all users to see.

### Custom Personas

Add a persona visible to all users:
- **Icon** — an emoji that appears in the persona picker
- **Label** — the persona name
- **Description** — shown in the persona picker to explain who this persona is for

Once created, each user can independently configure heat metrics, thresholds, and app links for a custom persona in their Personal settings.

---

## 16. Custom DQL Metrics

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

## 17. Best Practices

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
2. Check the **Activity Pattern** first — Transient vs Sustained tells you whether the incident is ongoing.
3. Look at **Worst vs Best Buckets** to identify which metrics were worst at peak.
4. Use the **Cross-Metric Correlation** table to find cascading effects. If Error Rate drives Response Time (Rate = 95%), fixing errors will likely fix latency too.
5. Use **Next Steps** to launch directly into the right Dynatrace app.

### Custom personas for teams

If you support multiple teams with different concerns, create a custom persona per team in Settings → All Users. Each team member can then select their team persona as default. Custom personas can cover any Dynatrace metric via DQL — there is no limit to what you can surface.

### Auto-refresh for war rooms

During major incidents, set auto-refresh to 300000ms (5 minutes) in Settings → General. The heat strip will stay live without manual intervention, so the room can focus on investigation rather than refreshing the dashboard.

---

## 18. Incident Response Workflow

This is the recommended flow for using NavigatorIQ during an active incident.

### Step 1 — Triage with the heat strip

1. Open **Last 2 Hours**
2. Look at the heat strip — identify the red bars
3. Note whether green (deployment) or red (Davis Problem) markers are present

### Step 2 — Identify the pattern

4. Click **🔥 Hotness Assist**
5. Check **Activity Pattern** — is this Transient (resolved) or Sustained (still ongoing)?
6. Check **Davis Problems** — is there already an open problem? If yes, coordinate with whoever owns it.

### Step 3 — Find the root metric

7. Look at **Worst vs Best Buckets** in Hotness Assist — which metrics were highest at peak?
8. Check the **Cross-Metric Correlation** table — which metrics are strongly linked?
9. The metric with the highest Z-score and the strongest correlations is your primary suspect.

### Step 4 — Drill down

10. Click **Explore** on the primary suspect metric
11. Review the entity breakdown — which services/hosts are driving the value?
12. Review diagnosis scenarios — what specific conditions are flagged?
13. Click the **Launch** button to open the full Dynatrace app at the right scope

### Step 5 — Validate the fix

14. After a remediation action (restart, config change, rollback), return to NavigatorIQ
15. Hit **⟳ Refresh** to re-run queries
16. Watch the heat strip — bars should start trending blue/yellow
17. If a deployment caused the incident, verify the new green dot appears and subsequent bars cool down

### Step 6 — Post-incident review

18. Switch to **Last 7 Days** to see the spike in weekly context
19. Open **Hotness Calendar** — was this hour/day pattern normal or truly anomalous?
20. Review thresholds — was the alert threshold appropriate, or does it need tuning?

---

## 19. Troubleshooting

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

| Persona | Default Heat Metrics | Key App Links |
|---------|---------------------|---------------|
| Developer | Request Volume, Error Rate, Response Time | Services, Logs, Distributed Traces |
| SRE / Platform | CPU, Memory, Disk Usage/I/O, Network | Infrastructure, Hosts, Processes |
| DBA | DB Query Volume, Avg Latency, P99 Latency, Slow Queries, DB Errors | Database & Storage |
| Network Admin | Bytes Sent/Received, Packets Sent/Received, Retransmissions | Infrastructure / Network |
| DevOps / CI/CD | Request Volume, Error Rate, CPU, Memory, Log Errors | Services, Logs, Workflows |
| Security | Vulnerability Severity, Attack Events | Security, Application Security |
| Digital Experience | RUM LCP, Sessions, Apdex, Synthetic Failures | Digital Experience, Synthetic |
| K8s | Container CPU, Container Memory, OOMKills | Kubernetes |

---

*NavigatorIQ Launcher is an unofficial community application. It is not supported by Dynatrace. Report issues or request features at [github.com/TechShady/NavigatorIQ](https://github.com/TechShady/NavigatorIQ).*
