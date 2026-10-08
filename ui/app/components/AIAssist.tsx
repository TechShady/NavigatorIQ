import React, { useMemo } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
export type InsightSeverity = "good" | "warning" | "critical" | "info";
export type InsightItem = { severity: InsightSeverity; icon: string; text: string };
export type RecommendationItem = { impact: "high" | "medium" | "low"; text: string };
export type AIAssistData = { summary: string; insights: InsightItem[]; recommendations: RecommendationItem[] };

// ── CSS injection ────────────────────────────────────────────────────────────
const STYLE_ID = "cio-ai-assist-styles";
export function ensureStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
.cio-ai-panel {
  border: 1px solid rgba(165,110,255,0.25);
  border-radius: 10px;
  background: rgba(165,110,255,0.04);
  overflow: hidden;
  animation: cio-ai-slide-in 0.25s ease-out;
  margin: 0 0 4px;
}
@keyframes cio-ai-slide-in {
  from { opacity: 0; max-height: 0; transform: translateY(-8px); }
  to   { opacity: 1; max-height: 2000px; transform: translateY(0); }
}
.cio-ai-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(165,110,255,0.15);
}
.cio-ai-header svg { width: 16px; height: 16px; flex-shrink: 0; }
.cio-ai-title { font-size: 13px; font-weight: 700; color: #e8eaf0; flex: 1; }
.cio-ai-close {
  background: none; border: none; cursor: pointer;
  color: #8b92a8; font-size: 14px; padding: 2px 6px; line-height: 1;
}
.cio-ai-close:hover { color: #e8eaf0; }
.cio-ai-pdf {
  background: none; border: none; cursor: pointer;
  color: #8b92a8; padding: 2px 4px; line-height: 1; display: flex; align-items: center;
  transition: color 0.15s ease;
}
.cio-ai-pdf:hover { color: #a78bfa; }
.cio-ai-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 14px; }
.cio-ai-section-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.8px; color: #5c6480; margin-bottom: 6px;
}
.cio-ai-summary-box {
  padding: 10px 14px; border-radius: 8px;
  background: rgba(165,110,255,0.06);
  border: 1px solid rgba(165,110,255,0.12);
  font-size: 13px; line-height: 1.55; color: #c8cedf;
}
.cio-ai-insight-row {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 6px 10px; border-radius: 6px; margin-bottom: 4px;
  font-size: 13px; line-height: 1.5; color: #c8cedf;
}
.cio-ai-insight-row.good     { background: rgba(0,210,106,0.06);  border-left: 3px solid #00D26A; }
.cio-ai-insight-row.warning  { background: rgba(252,213,63,0.06); border-left: 3px solid #FCD53F; }
.cio-ai-insight-row.critical { background: rgba(248,49,47,0.06);  border-left: 3px solid #F8312F; }
.cio-ai-insight-row.info     { background: rgba(82,108,255,0.06); border-left: 3px solid #526cff; }
.cio-ai-rec-row {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 7px 10px; border-radius: 6px; margin-bottom: 4px;
  background: rgba(255,255,255,0.03);
  font-size: 13px; line-height: 1.5; color: #c8cedf;
}
.cio-ai-badge {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  padding: 2px 6px; border-radius: 3px; white-space: nowrap; flex-shrink: 0; margin-top: 1px;
}
.cio-ai-badge.high   { background: rgba(248,49,47,0.15);  color: #F8312F; }
.cio-ai-badge.medium { background: rgba(252,213,63,0.15); color: #FCD53F; }
.cio-ai-badge.low    { background: rgba(255,255,255,0.08); color: #8b92a8; }
@keyframes cio-ai-word-in {
  from { opacity: 0; transform: translateY(3px); }
  to   { opacity: 1; transform: translateY(0); }
}
.cio-ai-word { display: inline; opacity: 0; animation: cio-ai-word-in 0.25s ease forwards; }
.cio-ai-assist-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 14px; border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.12);
  background: #1e2030;
  color: #e8eaf0; font-size: 13px; font-weight: 700;
  cursor: pointer; transition: all 0.18s ease; white-space: nowrap;
  letter-spacing: 0.01em;
}
.cio-ai-assist-btn:hover { background: #252840; border-color: rgba(165,110,255,0.4); }
.cio-ai-assist-btn.active { background: #252840; border-color: rgba(165,110,255,0.55); box-shadow: 0 0 10px rgba(165,110,255,0.15); }
`;
  document.head.appendChild(s);
}

// ── SparkleIcon ──────────────────────────────────────────────────────────────
function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M14 4L15.2 9.6L20 12L15.2 14.4L14 20L12.8 14.4L8 12L12.8 9.6Z" fill="url(#cio-sp-grad)" />
      <path d="M7 2L7.7 4.8L10 6L7.7 7.2L7 10L6.3 7.2L4 6L6.3 4.8Z" fill="url(#cio-sp-grad)" />
      <path d="M5 13L5.5 14.8L7 16L5.5 17.2L5 19L4.5 17.2L3 16L4.5 14.8Z" fill="url(#cio-sp-grad)" />
      <defs>
        <linearGradient id="cio-sp-grad" x1="3" y1="2" x2="20" y2="20">
          <stop stopColor="#c084fc" /><stop offset="1" stopColor="#818cf8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── StreamText ───────────────────────────────────────────────────────────────
function StreamText({ text, baseDelay }: { text: string; baseDelay: number }) {
  const words = text.split(/(\s+)/);
  let wi = 0;
  return (
    <>
      {words.map((w, i) => {
        if (/^\s+$/.test(w)) return w;
        const delay = baseDelay + wi * 50;
        wi++;
        return <span key={i} className="cio-ai-word" style={{ animationDelay: `${delay}ms` }}>{w}</span>;
      })}
    </>
  );
}

// ── MarkdownContent ───────────────────────────────────────────────────────────
function MarkdownContent({ text, baseDelay = 100 }: { text: string; baseDelay?: number }) {
  const counter = { i: 0 };
  const WPD = 35;

  const word = (w: string): React.ReactNode => {
    const delay = baseDelay + counter.i++ * WPD;
    return <span className="cio-ai-word" style={{ animationDelay: `${delay}ms` }}>{w}</span>;
  };

  const parseInline = (str: string): React.ReactNode => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    const out: React.ReactNode[] = [];
    parts.forEach((part, pi) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const inner = part.slice(2, -2);
        const tokens = inner.split(/(\s+)/);
        out.push(<strong key={pi} style={{ color: "#e8eaf0" }}>
          {tokens.map((t, ti) => /^\s+$/.test(t) ? t : <React.Fragment key={ti}>{word(t)}</React.Fragment>)}
        </strong>);
      } else {
        part.split(/(\s+)/).forEach((t, ti) => {
          out.push(/^\s+$/.test(t) ? t : <React.Fragment key={`${pi}-${ti}`}>{word(t)}</React.Fragment>);
        });
      }
    });
    return out;
  };

  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("### ") || trimmed.startsWith("## ")) {
      const content = trimmed.replace(/^#{2,3} /, "");
      nodes.push(<div key={i} style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 10, marginBottom: 4 }}>{parseInline(content)}</div>);
    } else if (trimmed.startsWith("# ")) {
      nodes.push(<div key={i} style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf0", marginTop: 6, marginBottom: 6 }}>{parseInline(trimmed.slice(2))}</div>);
    } else if (trimmed.match(/^\|[\s\-:|]+\|$/)) {
      // table separator row — skip
    } else if (trimmed.startsWith("|")) {
      const cells = trimmed.split("|").slice(1, -1).map(c => c.trim());
      const isHeader = i + 1 < lines.length && lines[i + 1].trim().match(/^\|[\s\-:|]+\|$/);
      nodes.push(
        <div key={i} style={{ display: "flex", gap: 12, marginBottom: 2, paddingBottom: isHeader ? 4 : 0, borderBottom: isHeader ? "1px solid rgba(165,110,255,0.2)" : "none" }}>
          {cells.map((cell, ci) => (
            <div key={ci} style={{ flex: 1, fontSize: 12, color: isHeader ? "#a78bfa" : "#c8cedf", fontWeight: isHeader ? 700 : 400 }}>{parseInline(cell)}</div>
          ))}
        </div>
      );
    } else if (trimmed.match(/^[-*] /)) {
      nodes.push(
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3, paddingLeft: 4 }}>
          <span style={{ color: "#a78bfa", flexShrink: 0, lineHeight: "20px" }}>•</span>
          <span style={{ fontSize: 13, color: "#c8cedf", lineHeight: 1.55 }}>{parseInline(trimmed.slice(2))}</span>
        </div>
      );
    } else if (line.match(/^\s{2,}[-*] /)) {
      nodes.push(
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 2, paddingLeft: 18 }}>
          <span style={{ color: "#6b7280", flexShrink: 0, lineHeight: "20px", fontSize: 11 }}>◦</span>
          <span style={{ fontSize: 12, color: "#8b92a8", lineHeight: 1.5 }}>{parseInline(trimmed.replace(/^\s+[-*] /, ""))}</span>
        </div>
      );
    } else {
      nodes.push(<div key={i} style={{ fontSize: 13, color: "#c8cedf", lineHeight: 1.6, marginBottom: 3 }}>{parseInline(trimmed)}</div>);
    }
  }

  return <>{nodes}</>;
}

function isMarkdown(text: string) {
  return /^#{1,3} |^\*\*|^\|.+\||^[-*] /m.test(text);
}

// ── PDF export ────────────────────────────────────────────────────────────────
function markdownToHtml(text: string): string {
  const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => escHtml(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  const lines = text.split("\n");
  const out: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { if (inTable) { out.push("</table>"); inTable = false; } continue; }

    if (t.startsWith("## ") || t.startsWith("### ")) {
      out.push(`<h3>${inline(t.replace(/^#{2,3} /, ""))}</h3>`);
    } else if (t.startsWith("# ")) {
      out.push(`<h2>${inline(t.slice(2))}</h2>`);
    } else if (t.match(/^\|[\s\-:|]+\|$/)) {
      // skip separator
    } else if (t.startsWith("|")) {
      const cells = t.split("|").slice(1, -1).map(c => c.trim());
      const isHeader = i + 1 < lines.length && lines[i + 1].trim().match(/^\|[\s\-:|]+\|$/);
      if (!inTable) { out.push("<table>"); inTable = true; }
      const tag = isHeader ? "th" : "td";
      out.push(`<tr>${cells.map(c => `<${tag}>${inline(c)}</${tag}>`).join("")}</tr>`);
    } else if (t.match(/^[-*] /)) {
      if (inTable) { out.push("</table>"); inTable = false; }
      out.push(`<li>${inline(t.slice(2))}</li>`);
    } else {
      if (inTable) { out.push("</table>"); inTable = false; }
      out.push(`<p>${inline(t)}</p>`);
    }
  }
  if (inTable) out.push("</table>");
  return out.join("\n");
}

function exportPDF(data: AIAssistData, title: string) {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const summaryHtml = isMarkdown(data.summary) ? markdownToHtml(data.summary) : `<p>${data.summary}</p>`;

  const insightsHtml = data.insights.map(ins => `
    <div class="insight ${ins.severity}">
      <span class="icon">${ins.icon}</span>
      <span>${ins.text}</span>
    </div>`).join("");

  const recsHtml = data.recommendations.map(rec => `
    <div class="rec">
      <span class="badge ${rec.impact}">${rec.impact}</span>
      <span>${rec.text}</span>
    </div>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 48px; color: #111827; font-size: 14px; line-height: 1.6; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 24px; }
  .header-title { font-size: 22px; font-weight: 700; color: #7c3aed; }
  .header-date { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; margin: 20px 0 8px; }
  .summary-box { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 14px 18px; }
  .summary-box p { margin: 4px 0; } .summary-box h2 { font-size: 15px; color: #7c3aed; margin: 14px 0 4px; } .summary-box h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #7c3aed; margin: 12px 0 4px; }
  .summary-box table { border-collapse: collapse; width: 100%; margin: 8px 0; } .summary-box th { font-weight: 700; color: #7c3aed; border-bottom: 2px solid #ddd6fe; padding: 4px 8px; text-align: left; font-size: 12px; } .summary-box td { padding: 4px 8px; border-bottom: 1px solid #ede9fe; font-size: 12px; } .summary-box li { margin: 3px 0; }
  .insight { display: flex; gap: 10px; padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; }
  .insight.good { background: #f0fdf4; border-left: 3px solid #22c55e; } .insight.warning { background: #fffbeb; border-left: 3px solid #f59e0b; } .insight.critical { background: #fef2f2; border-left: 3px solid #ef4444; } .insight.info { background: #eff6ff; border-left: 3px solid #3b82f6; }
  .icon { flex-shrink: 0; }
  .rec { display: flex; gap: 10px; padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; background: #f9fafb; }
  .badge { font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 3px; white-space: nowrap; flex-shrink: 0; margin-top: 3px; }
  .badge.high { background: #fee2e2; color: #dc2626; } .badge.medium { background: #fef3c7; color: #d97706; } .badge.low { background: #f3f4f6; color: #6b7280; }
  @media print { @page { margin: 32px; } body { margin: 0; } }
</style></head><body>
<div class="header">
  <div><div class="header-title">${title}</div><div class="header-date">Generated ${date}</div></div>
</div>
<div class="label">Summary</div>
<div class="summary-box">${summaryHtml}</div>
${data.insights.length > 0 ? `<div class="label">Insights</div>${insightsHtml}` : ""}
${data.recommendations.length > 0 ? `<div class="label">Recommendations</div>${recsHtml}` : ""}
</body></html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
}

// ── AIAssistPanel ────────────────────────────────────────────────────────────
export function AIAssistPanel({ data, onClose, title = "AI Insights" }: { data: AIAssistData; onClose: () => void; title?: string }) {
  ensureStyles();
  const summaryWordCount = data.summary.split(/\s+/).length;
  const summaryDuration = summaryWordCount * 50;

  let insightOffset = summaryDuration + 300;
  const insightDurations = data.insights.map(ins => ins.text.split(/\s+/).length * 50);

  return (
    <div className="cio-ai-panel">
      <div className="cio-ai-header">
        <SparkleIcon />
        <span className="cio-ai-title">{title}</span>
        <button className="cio-ai-pdf" title="Export to PDF" onClick={() => exportPDF(data, title)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9 15 12 18 15 15"/>
          </svg>
        </button>
        <button className="cio-ai-close" onClick={onClose}>✕</button>
      </div>
      <div className="cio-ai-body">
        {/* Summary */}
        <div>
          <div className="cio-ai-section-label" style={{ opacity: 0, animation: "cio-ai-word-in 0.25s ease forwards", animationDelay: "80ms" }}>Summary</div>
          <div className="cio-ai-summary-box">
            {isMarkdown(data.summary)
              ? <MarkdownContent text={data.summary} />
              : <StreamText text={data.summary} baseDelay={150} />}
          </div>
        </div>

        {/* Insights */}
        {data.insights.length > 0 && (
          <div>
            <div className="cio-ai-section-label" style={{ opacity: 0, animation: "cio-ai-word-in 0.25s ease forwards", animationDelay: `${insightOffset - 150}ms` }}>Insights</div>
            {data.insights.map((ins, i) => {
              const myOffset = insightOffset;
              insightOffset += insightDurations[i] + 200;
              return (
                <div key={i} className={`cio-ai-insight-row ${ins.severity}`} style={{ opacity: 0, animation: "cio-ai-word-in 0.25s ease forwards", animationDelay: `${myOffset - 80}ms` }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{ins.icon}</span>
                  <span><StreamText text={ins.text} baseDelay={myOffset} /></span>
                </div>
              );
            })}
          </div>
        )}

        {/* Recommendations */}
        {data.recommendations.length > 0 && (
          <div>
            <div className="cio-ai-section-label" style={{ opacity: 0, animation: "cio-ai-word-in 0.25s ease forwards", animationDelay: `${insightOffset}ms` }}>Recommendations</div>
            {data.recommendations.map((rec, i) => {
              const myOffset = insightOffset + 250 + i * 700;
              return (
                <div key={i} className="cio-ai-rec-row" style={{ opacity: 0, animation: "cio-ai-word-in 0.25s ease forwards", animationDelay: `${myOffset}ms` }}>
                  <span className={`cio-ai-badge ${rec.impact}`}>{rec.impact}</span>
                  <span><StreamText text={rec.text} baseDelay={myOffset + 80} /></span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Context ──────────────────────────────────────────────────────────────────
export const AIAssistContext = React.createContext<{ open: boolean; close: () => void }>({ open: false, close: () => {} });

// ── useAIAssist ──────────────────────────────────────────────────────────────
export function useAIAssist(analysisFn: () => AIAssistData): { panel: React.ReactNode } {
  const { open, close } = React.useContext(AIAssistContext);
  const data = useMemo(() => (open ? analysisFn() : null), [open, analysisFn]);
  return {
    panel: open && data ? (
      <div style={{ padding: "12px 20px 0" }}>
        <AIAssistPanel data={data} onClose={close} />
      </div>
    ) : null,
  };
}

// ── AIAssistButton ───────────────────────────────────────────────────────────
export function AIAssistButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  ensureStyles();
  return (
    <button className={`cio-ai-assist-btn${open ? " active" : ""}`} onClick={onToggle} title="AI Assist — intelligent insights for this tab">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M14 4L15.2 9.6L20 12L15.2 14.4L14 20L12.8 14.4L8 12L12.8 9.6Z" fill="url(#cio-ai-btn-g)" />
        <path d="M7 2L7.7 4.8L10 6L7.7 7.2L7 10L6.3 7.2L4 6L6.3 4.8Z" fill="url(#cio-ai-btn-g)" />
        <path d="M5 13L5.5 14.8L7 16L5.5 17.2L5 19L4.5 17.2L3 16L4.5 14.8Z" fill="url(#cio-ai-btn-g)" />
        <defs>
          <linearGradient id="cio-ai-btn-g" x1="3" y1="2" x2="20" y2="20">
            <stop stopColor="#c084fc" /><stop offset="1" stopColor="#818cf8" />
          </linearGradient>
        </defs>
      </svg>
      AI Assist
    </button>
  );
}
