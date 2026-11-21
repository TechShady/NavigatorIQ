import { PopupWindow, PopupCloseButton } from "./PopupWindow";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { escapeHtml } from "./escapeHtml";

export interface DimSlice { name: string; value: number; avg?: number; unit?: string; numerator?: number; denominator?: number; }

export interface DimensionModalProps {
  label: string;
  color?: string;
  onClose: () => void;
  fetchGeo?: (pct: string) => Promise<DimSlice[]>;
  fetchBrowser?: (pct: string) => Promise<DimSlice[]>;
  strictData?: boolean;
  description?: string;
  firstTitle?: string;
  secondTitle?: string;
}

const GEO_COLORS     = ["#4589FF", "#23A5D0", "#3FA66C", "#A66C3F", "#8B5CF6", "#64748B", "#F59E0B", "#EC4899"];
const BROWSER_COLORS = ["#FF6B35", "#4ECDC4", "#45B7D1", "#96CEB4", "#B0B0B0", "#F59E0B"];

const PCT_OPTIONS = ["P50", "P75", "P90", "P95", "P99"] as const;
type PctOption = typeof PCT_OPTIONS[number];

function formatAvg(avg: number, unit?: string): string {
  if (unit === "ms") return avg >= 1000 ? `${(avg / 1000).toFixed(2)} s` : `${avg.toFixed(0)} ms`;
  if (unit === "s") return avg >= 1 ? `${avg.toFixed(2)} s` : `${(avg * 1000).toFixed(0)} ms`;
  if (unit === "%") return `${avg.toFixed(1)}%`;
  return avg.toFixed(2);
}

// ─── SVG Pie Chart ────────────────────────────────────────────────────────────

function PieChart({ data, title, colors, pct }: { data: DimSlice[]; title: string; colors: string[]; pct: PctOption }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <div style={{ opacity: 0.4, fontSize: 12, textAlign: "center", padding: 32 }}>No data</div>;

  const R = 78, Rh = 84;
  const cx = 92, cy = 92;
  let startAngle = -Math.PI / 2;

  const hasAvg = data.some(d => d.avg != null);
  const isRate = data.some(d => d.denominator != null);

  const slices = data.map((d, i) => {
    const angle = (d.value / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const r = hovered === i ? Rh : R;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    const pctShare = (d.value / total) * 100;
    const result = { path, color: colors[i % colors.length], slice: d, pct: pctShare };
    startAngle = endAngle;
    return result;
  });

  const hovSlice = hovered !== null ? slices[hovered] : null;

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.45, textTransform: "uppercase" as const, marginBottom: 12, letterSpacing: "0.06em" }}>{title}</div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
        <svg width={184} height={184} style={{ flexShrink: 0, overflow: "visible" }}>
          {slices.map((s, i) => (
            <path
              key={i}
              d={data.length === 1 ? `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx} ${cy + R} A ${R} ${R} 0 1 1 ${cx} ${cy - R} Z` : s.path}
              fill={s.color}
              stroke="#151829"
              strokeWidth={hovered === i ? 2 : 1.5}
              style={{ cursor: "pointer", transition: "all 0.15s ease" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          {/* Center hole */}
          <circle cx={cx} cy={cy} r={34} fill="#151829" />
          {hovSlice && (
            <>
              <text x={cx} y={cy - (hovSlice.slice.avg != null ? 9 : 5)} textAnchor="middle" fontSize={hovSlice.slice.avg != null ? 9 : 11} fill="#e8eaf0" fontWeight={700}>
                {hovSlice.slice.avg != null ? formatAvg(hovSlice.slice.avg, hovSlice.slice.unit) : `${hovSlice.pct.toFixed(1)}%`}
              </text>
              {hovSlice.slice.avg != null && (
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize={8} fill="rgba(232,234,240,0.45)">{hovSlice.pct.toFixed(1)}%</text>
              )}
              <text x={cx} y={cx + (hovSlice.slice.avg != null ? 14 : 10)} textAnchor="middle" fontSize={8} fill="rgba(232,234,240,0.5)">
                {hovSlice.slice.name.length > 13 ? hovSlice.slice.name.slice(0, 12) + "…" : hovSlice.slice.name}
              </text>
            </>
          )}
        </svg>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, paddingTop: 4, flex: 1, minWidth: 0 }}>
          {hasAvg && (
            <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2, fontWeight: 600, letterSpacing: "0.04em" }}>
              {isRate ? "RATE" : pct} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {isRate ? "SESSION SHARE" : "SHARE"}
            </div>
          )}
          {slices.map((s, i) => (
            <div
              key={i}
              title={s.slice.denominator != null ? `${s.slice.numerator} affected / ${s.slice.denominator} sessions; rate ${formatAvg(s.slice.avg ?? 0, "%")}; session share ${s.pct.toFixed(1)}%` : undefined}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: hovered !== null && hovered !== i ? 0.35 : 1, transition: "opacity 0.12s" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, opacity: 0.85, flex: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{s.slice.name}</span>
              {s.slice.avg != null && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#e8eaf0", flexShrink: 0 }}>{formatAvg(s.slice.avg, s.slice.unit)}</span>
              )}
              <span style={{ fontSize: 10, opacity: 0.45, fontWeight: 600, flexShrink: 0, minWidth: 30, textAlign: "right" as const }}>{s.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
      {isRate && <div style={{ fontSize: 10, opacity: 0.55, marginTop: 10 }}>Rate = affected / total sessions. Donut size and share show total sessions, not rate.</div>}
    </div>
  );
}

// ─── Fallback Data ─────────────────────────────────────────────────────────────

const DEFAULT_GEO: DimSlice[] = [
  { name: "United States", value: 38 },
  { name: "United Kingdom", value: 17 },
  { name: "Germany", value: 14 },
  { name: "France", value: 9 },
  { name: "Canada", value: 8 },
  { name: "Australia", value: 6 },
  { name: "Other", value: 8 },
];

const DEFAULT_BROWSER: DimSlice[] = [
  { name: "Chrome", value: 57 },
  { name: "Safari", value: 23 },
  { name: "Firefox", value: 10 },
  { name: "Edge", value: 8 },
  { name: "Other", value: 2 },
];

// ─── PDF Export ───────────────────────────────────────────────────────────────

function exportDimensionPdf(label: string, geoData: DimSlice[], browserData: DimSlice[], strictData = false, firstTitle = "Geo (Country)", secondTitle = "Browser") {
  const w = window.open("", "_blank");
  if (!w) return;
  const fmtRow = (d: DimSlice) => `<tr><td>${escapeHtml(d.name)}</td><td style="text-align:right">${d.value}</td>${d.denominator != null ? `<td style="text-align:right">${d.numerator}</td>` : ""}${d.avg != null ? `<td style="text-align:right">${formatAvg(d.avg, d.unit)}</td>` : ""}</tr>`;
  const table = (title: string, rows: DimSlice[]) => {
    const isRate = rows.some(r => r.denominator != null);
    return `<h2>${title}</h2><table border="1" cellpadding="6" style="border-collapse:collapse;width:100%"><thead><tr><th>Name</th><th>${isRate ? "Total sessions" : strictData ? "Value" : "Sessions"}</th>${isRate ? "<th>Affected sessions</th>" : ""}${rows.some(r => r.avg != null) ? `<th>${isRate ? "Rate" : "Avg"}</th>` : ""}</tr></thead><tbody>${rows.map(fmtRow).join("")}</tbody></table>`;
  };
  const safeLabel = escapeHtml(label);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dimension — ${safeLabel}</title><style>body{font-family:'Segoe UI',system-ui,sans-serif;padding:24px;background:#0f1221;color:#e8eaf0}h1{margin-bottom:4px}h2{margin-top:20px}table{border-color:rgba(255,255,255,0.15)}th,td{color:#e8eaf0;background:#1a1e36}@media print{body{background:#fff;color:#111}th,td{color:#111;background:#fff}}</style></head><body><h1>🌍 Dimension Breakdown — ${safeLabel}</h1><p style="opacity:0.5;font-size:11px">Generated ${new Date().toLocaleString()}</p>${table(escapeHtml(firstTitle), geoData)}${table(escapeHtml(secondTitle), browserData)}</body></html>`;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DimensionModal({ label, color, onClose, fetchGeo, fetchBrowser, strictData = false, description, firstTitle = "GEO breakdown (country)", secondTitle = "Browser breakdown" }: DimensionModalProps) {
  const [geoData, setGeoData]         = useState<DimSlice[]>([]);
  const [browserData, setBrowserData] = useState<DimSlice[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [selectedPct, setSelectedPct] = useState<PctOption>("P50");

  const [dmPos, setDmPos] = useState(() => ({ x: Math.max(20, window.innerWidth / 2 - 410), y: Math.max(20, window.innerHeight / 2 - 220) }));
  const [dmSizeW, setDmSizeW] = useState(0);
  const [dmSizeH, setDmSizeH] = useState(0);
  const dmDragRef = useRef<{ startX: number; startY: number; startL: number; startT: number } | null>(null);
  const dmRzRef = useRef<{ startX: number; startY: number; startW: number; startH: number; mode: "w" | "h" | "wh" } | null>(null);
  const dmContRef = useRef<HTMLDivElement>(null);

  const fetchGeoRef     = useRef(fetchGeo);
  const fetchBrowserRef = useRef(fetchBrowser);
  fetchGeoRef.current     = fetchGeo;
  fetchBrowserRef.current = fetchBrowser;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dmDragRef.current) { const { startX, startY, startL, startT } = dmDragRef.current; setDmPos({ x: startL + (e.clientX - startX), y: startT + (e.clientY - startY) }); }
      if (dmRzRef.current) { const { mode, startX, startY, startW, startH } = dmRzRef.current; if (mode === "w" || mode === "wh") setDmSizeW(Math.max(500, startW + (e.clientX - startX))); if (mode === "h" || mode === "wh") setDmSizeH(Math.max(320, startH + (e.clientY - startY))); }
    };
    const onUp = () => { dmDragRef.current = null; dmRzRef.current = null; };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchGeoRef.current     ? fetchGeoRef.current(selectedPct)     : Promise.resolve(strictData ? [] : DEFAULT_GEO),
      fetchBrowserRef.current ? fetchBrowserRef.current(selectedPct) : Promise.resolve(strictData ? [] : DEFAULT_BROWSER),
    ])
      .then(([geo, browser]) => {
        if (!active) return;
        setGeoData(geo.length || strictData ? geo : DEFAULT_GEO);
        setBrowserData(browser.length || strictData ? browser : DEFAULT_BROWSER);
      })
      .catch((err: unknown) => { if (active) { if (strictData) setError(err instanceof Error ? err.message : String(err)); else { setGeoData(DEFAULT_GEO); setBrowserData(DEFAULT_BROWSER); } } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedPct, strictData]);

  return createPortal(
    <PopupWindow ref={dmContRef} style={{
      position: "fixed", left: dmPos.x, top: dmPos.y, zIndex: 9999,
      background: "#151829", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
      padding: "26px 32px", width: dmSizeW > 0 ? dmSizeW : 820,
      ...(dmSizeH > 0 ? { height: dmSizeH, display: "flex", flexDirection: "column" } : {}),
      boxShadow: "0 28px 70px rgba(0,0,0,0.6)", fontFamily: "'Segoe UI',system-ui,sans-serif",
      color: "#e8eaf0", userSelect: "none",
    }}>
      {/* Header */}
      <div onMouseDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; dmDragRef.current = { startX: e.clientX, startY: e.clientY, startL: dmPos.x, startT: dmPos.y }; }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, cursor: "move" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            <span style={{ marginRight: 8 }}>🌍</span>Dimension Breakdown
          </div>
          <div style={{ fontSize: 11, opacity: 0.4, marginTop: 3 }}>
            <span style={{ color: color ?? "#4589FF", fontWeight: 700 }}>{label}</span>
            &ensp;&middot;&ensp;{description ?? (strictData ? "Country & operating system · selected timeframe" : "Geographic & Browser distribution · last 7 days")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Percentile selector */}
          {!strictData && <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: 3 }}>
            {PCT_OPTIONS.map(p => (
              <button
                key={p}
                onClick={() => setSelectedPct(p)}
                style={{
                  padding: "3px 8px", fontSize: 10, fontWeight: 700, borderRadius: 6, border: "none",
                  cursor: "pointer", background: selectedPct === p ? (color ?? "#4589FF") : "transparent",
                  color: selectedPct === p ? "#fff" : "rgba(232,234,240,0.45)", letterSpacing: "0.02em", transition: "all 0.15s",
                }}
              >{p}</button>
            ))}
          </div>}
          <button disabled={loading || !!error} onClick={() => exportDimensionPdf(label, geoData, browserData, strictData, firstTitle, secondTitle)} style={{ background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.3)", borderRadius: 6, color: "#4589FF", padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>📄 PDF</button>
          <PopupCloseButton onClick={onClose} style={{ background: "none", border: "none", color: "inherit", fontSize: 18, cursor: "pointer", opacity: 0.35, padding: "4px 8px", lineHeight: 1 }}>&#x2715;</PopupCloseButton>
        </div>
      </div>

      <div style={{ ...(dmSizeH > 0 ? { flex: 1, overflowY: "auto" } : {}) }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0", opacity: 0.45, fontSize: 13 }}>Loading dimension data&hellip;</div>
        ) : error ? (
          <div role="alert" style={{ color: "#F87171", fontSize: 12 }}>{error}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 28, alignItems: "start" }}>
            <PieChart data={geoData} title={firstTitle} colors={GEO_COLORS} pct={selectedPct} />
            <div style={{ background: "rgba(255,255,255,0.07)", height: "100%", minHeight: 200 }} />
            <PieChart data={browserData} title={secondTitle} colors={BROWSER_COLORS} pct={selectedPct} />
          </div>
        )}
        <div style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 10, opacity: 0.3, textAlign: "right" }}>
          Dimension Breakdown &middot; NavigatorIQ
        </div>
      </div>
      {/* Right-edge resize handle */}
      <div onMouseDown={(e) => { e.stopPropagation(); dmRzRef.current = { startX: e.clientX, startY: e.clientY, startW: (dmContRef.current?.offsetWidth ?? dmSizeW) || 820, startH: (dmContRef.current?.offsetHeight ?? dmSizeH) || 450, mode: "w" }; }} style={{ position: "absolute", top: 40, bottom: 20, right: 0, width: 6, cursor: "ew-resize" }} />
      {/* Corner resize handle */}
      <div onMouseDown={(e) => { e.stopPropagation(); dmRzRef.current = { startX: e.clientX, startY: e.clientY, startW: (dmContRef.current?.offsetWidth ?? dmSizeW) || 820, startH: (dmContRef.current?.offsetHeight ?? dmSizeH) || 450, mode: "wh" }; }} style={{ position: "absolute", right: 0, bottom: 0, width: 16, height: 16, cursor: "nwse-resize", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 2 }}>
        <svg width={10} height={10} viewBox="0 0 10 10"><path d="M9 1L1 9M5 1L1 5M9 5L5 9" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeLinecap="round" /></svg>
      </div>
    </PopupWindow>,
    document.body
  );
}
