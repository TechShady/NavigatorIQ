import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { aggregateDqlDimensions, buildMobileErrorDetailQuery, buildMobileSessionDetailQuery, makeMetricFmt, mobileSessionHistoryWindow, parseMobileSessionHistory } from "../queries";
import { linearForecast } from "./ForecastModal";
import { PopupWindow, PopupCloseButton } from "./PopupWindow";
import { getDqlDimensions, getDqlHistory, usesMobileSessionRows } from "./DqlDrillData";
import type { DqlDrillContext } from "./DqlDrillData";
import { summarizeDrillHistory } from "../drillHistory";

export type MobileSessionDrill = "forecast" | "diagnose" | "baseline" | "cost" | "heatmap" | "dimension" | "impact" | "anomaly";

const titles: Record<MobileSessionDrill, string> = {
  forecast: "Forecast", diagnose: "Diagnose", baseline: "Baseline", cost: "Cost Impact",
  heatmap: "Heatmap", dimension: "Dimension", impact: "Impact", anomaly: "Anomaly",
};

function numberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function HistoryContent({ type, values, startMs, isError }: { type: MobileSessionDrill; values: number[]; startMs: number; isError: boolean }) {
  const latest = values[values.length - 1];
  const previous = values.slice(0, -1);
  const mean = previous.reduce((a, b) => a + b, 0) / previous.length;
  const std = Math.sqrt(previous.reduce((sum, value) => sum + (value - mean) ** 2, 0) / previous.length);
  const format = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const unit = isError ? "errors" : "sessions";
  if (type === "heatmap") {
    const grid: number[][][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => []));
    values.forEach((value, i) => {
      const date = new Date(startMs + i * 3600000);
      grid[date.getDay()][date.getHours()].push(value);
    });
    const maximum = Math.max(...values, 1);
    return <>
      <p>Average {isError ? "errors" : "sessions started"} per hour, by local day and hour. Color indicates volume, not health.</p>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "40px repeat(24, minmax(17px, 1fr))", gap: 2, minWidth: 470 }}>
          <span />{Array.from({ length: 24 }, (_, hour) => <span key={hour} style={{ fontSize: 9, textAlign: "center" }}>{hour % 3 === 0 ? hour : ""}</span>)}
          {grid.map((hours, day) => <React.Fragment key={day}>
            <span style={{ fontSize: 10 }}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]}</span>
            {hours.map((bucket, hour) => {
              const avg = bucket.length ? bucket.reduce((a, b) => a + b, 0) / bucket.length : null;
              return <div key={hour} title={avg === null ? "No data" : `${format(avg)} ${unit}/hour`} style={{ height: 18, borderRadius: 2, background: avg === null ? "rgba(255,255,255,0.05)" : `rgba(69,137,255,${0.15 + 0.85 * avg / maximum})` }} />;
            })}
          </React.Fragment>)}
        </div>
      </div>
    </>;
  }
  if (type === "forecast") {
    const forecast = linearForecast(values, 12);
    const all = [...values, ...forecast];
    const max = Math.max(...all, 1);
    const point = (n: number, i: number) => `${(i / (all.length - 1)) * 600},${100 - (n / max) * 90}`;
    return <>
      <p>Linear trend projection for the next 12 hourly buckets, based on the previous seven days. This is an estimate, not a prediction of causes or business outcomes.</p>
      <svg viewBox="0 0 600 110" width="100%" role="img" aria-label={`Hourly ${unit} history and linear forecast`}>
        <polyline fill="none" stroke="#7ab4ff" strokeWidth="2" points={values.map(point).join(" ")} />
        <polyline fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="5 3" points={[point(latest, values.length - 1), ...forecast.map((v, i) => point(v, values.length + i))].join(" ")} />
      </svg>
      <div>Latest hour: {format(latest)} {unit} · Projected hour 12: {format(forecast[forecast.length - 1])} {unit}</div>
    </>;
  }
  return <>
    <p>Latest complete hourly bucket compared with the preceding hourly buckets in this seven-day window.</p>
    <div>Latest hour: <strong>{format(latest)} {unit}</strong></div>
    <div>Historical hourly mean: <strong>{format(mean)} {unit}</strong></div>
    <div>Historical standard deviation: <strong>{format(std)} {unit}</strong></div>
    {type === "anomaly" && <div>{std > 0 ? `Deviation from mean: ${((latest - mean) / std).toFixed(2)} standard deviations` : "Anomaly score unavailable: historical values have no variation."}</div>}
    <p>{isError ? "Error volume alone does not establish the cause of a change." : "Session volume alone does not establish whether a change is good or bad."}</p>
  </>;
}

function MobileSessionData({ type, frontend, errorType, from, to }: { type: MobileSessionDrill; frontend: string; errorType?: string | null; from: string; to: string }) {
  const history = type === "forecast" || type === "baseline" || type === "anomaly" || type === "heatmap";
  const windowResult = useMemo(() => {
    if (!history) return null;
    try { return { window: mobileSessionHistoryWindow(to), error: null }; }
    catch (error) { return { window: null, error: error instanceof Error ? error.message : String(error) }; }
  }, [history, to]);
  if (windowResult?.error) return <div role="alert">{windowResult.error}</div>;
  const timeWindow = windowResult?.window;
  const kind = history ? "history" : type === "dimension" ? "dimension" : "impact";
  const query = errorType !== undefined
    ? buildMobileErrorDetailQuery(frontend, errorType, timeWindow?.from ?? from, timeWindow?.to ?? to, kind)
    : buildMobileSessionDetailQuery(frontend, timeWindow?.from ?? from, timeWindow?.to ?? to, kind);
  return <MobileSessionQuery type={type} query={query} startMs={timeWindow?.startMs} end={timeWindow?.to} isError={errorType !== undefined} />;
}

function MobileSessionQuery({ type, query, startMs, end, isError }: { type: MobileSessionDrill; query: string; startMs?: number; end?: string; isError: boolean }) {
  const result = useDql<Record<string, unknown>>({ query });
  if (result.isLoading) return <div>Loading {isError ? "error" : "session"} data...</div>;
  if (result.isError) return <div role="alert" style={{ color: "#F87171" }}>Query failed: {result.error.message}</div>;
  if (!result.isSuccess) return null;
  const records = result.data?.records ?? [];
  if (startMs !== undefined) {
    const values = parseMobileSessionHistory(records, startMs);
    if (!values) return <div role="alert">No usable hourly {isError ? "error" : "session"} history was returned for the requested seven-day window.</div>;
    return <>
      <div style={{ fontSize: 11, opacity: 0.7 }}>Seven days ending {end?.replace(/"/g, "")}; hourly {isError ? "error counts" : "session starts"}. Recent data can arrive late.</div>
      <HistoryContent type={type} values={values} startMs={startMs} isError={isError} />
    </>;
  }
  if (type === "dimension") {
    if (!records.length) return <div>No {isError ? "error event" : "session"} dimension data in the selected timeframe.</div>;
    return <>
      <p>{isError ? "Error event" : "Session"} counts by country and operating system, in the selected timeframe.{isError && " Event counts may differ from metric counts."}</p>
      {records.map((record, i) => {
        const value = numberField(record, "value");
        return <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <span>{typeof record.country === "string" ? record.country : "Unknown country"} / {typeof record.os === "string" ? record.os : "Unknown OS"}</span>
          <strong>{value === null ? "Invalid count" : value.toLocaleString()}</strong>
        </div>;
      })}
    </>;
  }
  const record = records[0];
  if (!record) return <div>No session data in the selected timeframe.</div>;
  if (isError) {
    const events = numberField(record, "events");
    const sessions = numberField(record, "sessions");
    const users = numberField(record, "users");
    if (events === null || sessions === null || users === null) return <div role="alert">The error impact query returned invalid counts.</div>;
    return <>
      <p>Error events for this frontend and error type in the selected timeframe; event counts may differ from metric counts.</p>
      <div>Error events: <strong>{events.toLocaleString()}</strong></div>
      <div>Estimated distinct session IDs: <strong>{sessions.toLocaleString()}</strong></div>
      <div>Estimated distinct instance IDs: <strong>{users.toLocaleString()}</strong></div>
      <p>Missing IDs are not counted. These observations do not establish cause or financial impact.</p>
    </>;
  }
  const sessions = numberField(record, "sessions");
  const crashes = numberField(record, "crashes");
  const crashCoverage = numberField(record, "crashCoverage");
  const errors = numberField(record, "errors");
  const errorCoverage = numberField(record, "errorCoverage");
  if (sessions === null || crashes === null || crashCoverage === null || errors === null || errorCoverage === null || crashes > crashCoverage || errors > errorCoverage || crashCoverage > sessions || errorCoverage > sessions) return <div role="alert">The session impact query returned invalid counts.</div>;
  if (sessions === 0) return <p>No recorded sessions started in the selected timeframe.</p>;
  const pct = (n: number, d: number) => `${(n * 100 / d).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  return <>
    <p>{sessions.toLocaleString()} recorded sessions started in the selected timeframe.</p>
    <Finding title="Sessions with errors">{errorCoverage ? `${errors.toLocaleString()} of ${errorCoverage.toLocaleString()} with error telemetry (${pct(errors, errorCoverage)}); ${(sessions - errorCoverage).toLocaleString()} without that field.` : "Unavailable: no sessions reported the error count field."}</Finding>
    <Finding title="Sessions with a crash">{crashCoverage ? `${crashes.toLocaleString()} of ${crashCoverage.toLocaleString()} with crash telemetry (${pct(crashes, crashCoverage)}); ${(sessions - crashCoverage).toLocaleString()} without that field.` : "Unavailable: no sessions reported the crash field."}</Finding>
    <p>Rates here use only sessions reporting each field and can differ from the metric rate. Recent sessions can arrive late. Totals can overlap across frontends and do not measure unique users or financial impact.</p>
  </>;
}

function Finding({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={{ padding: "9px 12px", margin: "8px 0", borderLeft: "2px solid #4589FF", background: "rgba(110,140,200,0.12)", borderRadius: 5 }}>
    <strong>{title}</strong><div>{children}</div>
  </section>;
}

function DrillSegments({ context }: { context: DqlDrillContext }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof getDqlDimensions>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getDqlDimensions(context).then(records => { if (active) setResult(records); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : String(err)); });
    return () => { active = false; };
  }, [context]);
  function segment(dimension: "country" | "os") {
    const top = result && aggregateDqlDimensions(result, dimension)
      .filter(slice => (slice.avg ?? slice.value) > 0)
      .sort((a, b) => (b.avg ?? b.value) - (a.avg ?? a.value))[0];
    return top ? `${top.name}: ${makeMetricFmt(top.avg === undefined ? context.metric.displayUnit : "pct")(top.avg ?? top.value)}${top.denominator != null ? ` across ${top.denominator.toLocaleString()} sessions` : ""}` : "No nonzero values reported";
  }
  if (error) return <Finding title="Segment data unavailable">{error}</Finding>;
  if (!result) return <Finding title="Selected timeframe segments">Loading…</Finding>;
  try {
    return <Finding title="Leading segments in the selected timeframe">
      {context.metric.drilldownDimensionFirstLabel ?? "Country"}: {segment("country")}<br />
      {context.metric.drilldownDimensionSecondLabel ?? "Operating system"}: {segment("os")}
      <div>Open Dimension for the full breakdown. Segment concentration does not establish cause.</div>
    </Finding>;
  } catch (err) {
    return <Finding title="Segment data unavailable">{err instanceof Error ? err.message : String(err)}</Finding>;
  }
}

function DetailedHistory({ type, context }: { type: MobileSessionDrill; context: DqlDrillContext }) {
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getDqlHistory>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getDqlHistory(context, 7, 60).then(result => { if (active) setHistory(result); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : String(err)); });
    return () => { active = false; };
  }, [context]);
  if (error) return <div role="alert">{error}</div>;
  if (!history) return <div role="status">Loading hourly history…</div>;
  const { values, startMs, endMs, bucketMs } = history;
  const stats = summarizeDrillHistory(values);
  const fmt = makeMetricFmt(context.metric.displayUnit);
  const maximum = Math.max(1, stats.upper, values[stats.peak]);
  const x = (index: number) => 4 + 592 * index / (values.length - 1);
  const y = (value: number) => 96 - 92 * value / maximum;
  const latestStart = new Date(endMs - bucketMs).toLocaleString();
  const peakStart = new Date(startMs + stats.peak * bucketMs).toLocaleString();
  const direction = stats.delta > 0 ? "above" : stats.delta < 0 ? "below" : "at";
  return <>
    <p>{context.metric.label} · hourly history through {new Date(endMs).toLocaleString()}.{usesMobileSessionRows(context) && " The most recent two hours are excluded to allow for session ingestion."}</p>
    <svg viewBox="0 0 600 100" width="100%" role="img" aria-label={`${context.metric.label} hourly history with historical mean and three-standard-deviation band`}>
      <rect x="4" y={y(stats.upper)} width="592" height={y(stats.lower) - y(stats.upper)} fill="#4589FF" fillOpacity="0.15" />
      <line x1="4" x2="596" y1={y(stats.mean)} y2={y(stats.mean)} stroke="#a78bfa" strokeDasharray="5 3" />
      <polyline fill="none" stroke="#7ab4ff" strokeWidth="2" points={values.map((value, i) => `${x(i)},${y(value)}`).join(" ")} />
      <circle cx={x(values.length - 1)} cy={y(stats.latest)} r="3" fill={stats.flagged ? "#F87171" : "#7ab4ff"} />
    </svg>
    <Finding title={type === "anomaly" ? "Anomaly check" : "Latest complete hour"}>
      {latestStart}: <strong>{fmt(stats.latest)}</strong>, {direction} the historical mean of {fmt(stats.mean)}.
      {type === "anomaly" && <div>{stats.score === null ? "Anomaly score unavailable: the baseline has no variation."
        : `${stats.score.toFixed(2)} standard deviations from the mean. ${stats.flagged ? "Meets the 3σ review threshold." : "Below the 3σ review threshold."}`}</div>}
    </Finding>
    <Finding title="Baseline distribution">
      {stats.sampleSize} prior hourly buckets · P10 {fmt(stats.p10)} · median {fmt(stats.median)} · P90 {fmt(stats.p90)}.
      <div>Review band (mean ± 3σ, lower bound floored at zero): {fmt(stats.lower)} – {fmt(stats.upper)}.</div>
    </Finding>
    {type !== "baseline" && <Finding title="Peak and next step">
      Peak: {fmt(values[stats.peak])} at {peakStart}. {usesMobileSessionRows(context) ? "Compare the peak against session volume and the country/OS breakdown before attributing the change to a release or app issue." : "Compare the peak with related metrics before drawing conclusions about cause."}
    </Finding>}
  </>;
}

export function MobileSessionDrillPanel({ type, frontend, errorType, from, to, onClose, context }: { type: MobileSessionDrill; frontend: string; errorType?: string | null; from: string; to: string; onClose: () => void; context?: DqlDrillContext }) {
  const [pos, setPos] = useState(() => ({ x: Math.max(12, window.innerWidth / 2 - 280), y: Math.max(12, window.innerHeight * 0.1) }));
  const content = useRef<HTMLDivElement>(null);
  const onDragStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const x = event.clientX, y = event.clientY, initial = pos;
    const move = (e: MouseEvent) => setPos({ x: initial.x + e.clientX - x, y: initial.y + e.clientY - y });
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const exportPdf = () => {
    const w = window.open("", "_blank");
    if (!w || !content.current) return;
    w.document.title = `${titles[type]} - ${frontend}`;
    const body = w.document.body;
    body.style.cssText = "font:13px 'Segoe UI',sans-serif;padding:32px;color:#111";
    const heading = w.document.createElement("h1");
    heading.textContent = `${titles[type]} - ${frontend}${errorType !== undefined ? ` / ${errorType ?? "Unknown"}` : ""}`;
    body.appendChild(heading);
    body.appendChild(w.document.importNode(content.current, true));
    setTimeout(() => w.print(), 400);
  };
  return createPortal(
      <PopupWindow style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 100011, background: "rgba(20,24,46,0.98)", border: "1px solid rgba(69,137,255,0.3)", borderRadius: 12, padding: "24px 28px", width: 560, maxWidth: "94vw", maxHeight: "min(80vh, calc(100vh - 24px))", minWidth: 340, minHeight: 280, resize: "both", overflow: "auto", color: "#E0E6F0", fontSize: 13, lineHeight: 1.6, boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
        <div onMouseDown={onDragStart} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, cursor: "move", marginBottom: 12 }}>
          <div><strong style={{ fontSize: 16, color: "#fff" }}>{titles[type]}</strong><div style={{ fontSize: 12, opacity: 0.5 }}>{frontend}{errorType !== undefined ? ` / ${errorType ?? "Unknown"}` : ""}</div></div>
          <div style={{ display: "flex", gap: 6 }}><button onClick={exportPdf} style={{ background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.3)", borderRadius: 6, color: "#4589FF", padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>📄 PDF</button>
          <PopupCloseButton onClick={onClose} style={{ background: "rgba(128,128,128,0.2)", border: "1px solid rgba(128,128,128,0.3)", borderRadius: 6, color: "#fff", padding: "4px 10px", cursor: "pointer", fontSize: 13 }}>✕</PopupCloseButton></div>
        </div>
        <div ref={content}>
          {type === "cost" ? <p>Cost Impact is unavailable without revenue or conversion data.</p>
            : context && (type === "diagnose" || type === "baseline" || type === "anomaly") ? <>
                <DetailedHistory type={type} context={context} />
                {type === "diagnose" && (context.mobileSession || context.errorFrontend || context.metric.drilldownDimensionQuery?.trim()) && <DrillSegments context={context} />}
              </>
            : type === "impact" && context && !usesMobileSessionRows(context) && !context.errorFrontend ?
              <p>Session or user impact is unavailable for this DQL metric; the metric history does not identify affected sessions or users.</p>
            : <MobileSessionData type={type} frontend={frontend} errorType={errorType} from={from} to={to} />}
        </div>
      </PopupWindow>,
    document.body,
  );
}
