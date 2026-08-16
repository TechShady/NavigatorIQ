import React, { useState } from "react";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";
import type { AppLink, AssessmentItem, PersonaId } from "../types";
import { DEFAULT_APP_LINKS } from "../constants";

interface AppLinksPanelProps {
  personaId: PersonaId;
  savedLinks: AppLink[] | undefined;
  assessmentItems: AssessmentItem[];
}

function openApp(appPath: string, tab?: string) {
  let base = "";
  try { base = getEnvironmentUrl(); } catch { /* not in Dynatrace shell */ }
  const path = tab ? `/ui/apps/${appPath}?tab=${encodeURIComponent(tab)}` : `/ui/apps/${appPath}`;
  window.open(`${base}${path}`, "_blank");
}

function LinkCard({ link }: { link: AppLink }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: hover ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", cursor: "pointer", transition: "all 0.15s" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: link.docsUrl ? 6 : 0 }}>
        <div
          style={{ flex: 1, fontSize: 13, fontWeight: 600, color: hover ? "#7ab4ff" : "rgba(255,255,255,0.85)" }}
          onClick={() => link.appPath && openApp(link.appPath)}
        >
          {link.label}
        </div>
        {link.appPath && (
          <button
            onClick={() => openApp(link.appPath)}
            style={{ background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.3)", borderRadius: 5, color: "#7ab4ff", fontSize: 11, padding: "3px 8px", cursor: "pointer", flexShrink: 0 }}
          >
            Open ↗
          </button>
        )}
      </div>
      {link.docsUrl && (
        <a
          href={link.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          📚 Docs
        </a>
      )}
    </div>
  );
}

function ContextCard({ item }: { item: AssessmentItem }) {
  const app = item.customApp;
  if (!app) return null;
  const [hover, setHover] = useState(false);
  const severityColors = { red: "#EF4444", yellow: "#F59E0B", green: "#10B981" };
  const color = severityColors[item.severity];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => openApp(app.appPath, app.tab)}
      style={{ background: hover ? `${color}12` : `${color}08`, border: `1px solid ${color}25`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", transition: "all 0.15s" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 5 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: hover ? "#e0e0e0" : "rgba(255,255,255,0.8)", marginBottom: 2 }}>
            {app.label} {app.tab ? `→ ${app.tab}` : ""}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>{item.title}</div>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>↗</div>
      </div>
    </div>
  );
}

export function AppLinksPanel({ personaId, savedLinks, assessmentItems }: AppLinksPanelProps) {
  const links = (savedLinks ?? DEFAULT_APP_LINKS[personaId] ?? []).filter((l) => l.enabled);
  const contextItems = assessmentItems.filter((item) => item.customApp && item.severity !== "green");

  return (
    <div>
      {/* Persona App Links */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
          App Links
        </div>
        {links.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {links.map((link, i) => <LinkCard key={i} link={link} />)}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", padding: "8px 0" }}>
            No app links configured. Add some in Settings.
          </div>
        )}
      </div>

      {/* Context-aware recommendations */}
      {contextItems.length > 0 && (
        <div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 16 }} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
            Context-Aware Recommendations
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {contextItems.map((item, i) => <ContextCard key={i} item={item} />)}
          </div>
        </div>
      )}
    </div>
  );
}
