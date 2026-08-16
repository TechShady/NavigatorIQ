import React, { useState, useEffect } from "react";
import { useUserAppState, useSetUserAppState } from "@dynatrace-sdk/react-hooks";
import type { PersonaDef, PersonaId } from "../types";

interface PersonaPickerModalProps {
  appVersion: string;
  whatsNew: string[];
  personas: PersonaDef[];
  defaultPersonaId?: PersonaId;
  onApply: (personaId: PersonaId) => void;
}

const APP_NAME = "NavigatorIQ";
const APP_DESC = "Persona-driven operational intelligence for Dynatrace. Select your role to get a tailored assessment of what matters, what needs attention, and where to go next.";
const REPO_URL = "https://github.com/TechShady/NavigatorIQ";
const BLUE = "#4589FF";

export function PersonaPickerModal({ appVersion, whatsNew, personas, defaultPersonaId = "developer", onApply }: PersonaPickerModalProps) {
  const versionKey = `iq-persona-v${appVersion}`;
  const everKey = "iq-persona-ever";

  const versionState = useUserAppState({ key: versionKey });
  const everState = useUserAppState({ key: everKey });
  const { execute: saveState } = useSetUserAppState();

  const [visible, setVisible] = useState(false);
  const [isNewUser, setIsNewUser] = useState(true);
  const [selectedId, setSelectedId] = useState<PersonaId>(defaultPersonaId);
  const [hoverBtn, setHoverBtn] = useState(false);

  useEffect(() => {
    if (versionState.isLoading || everState.isLoading) return;
    if (versionState.data?.value === "seen") return;
    const prevPersona = everState.data?.value as PersonaId | undefined;
    setIsNewUser(!prevPersona);
    if (prevPersona) setSelectedId(prevPersona);
    else setSelectedId(defaultPersonaId);
    setVisible(true);
  }, [versionState.isLoading, versionState.data?.value, everState.isLoading, everState.data?.value, defaultPersonaId]);

  const handleContinue = () => {
    saveState({ key: versionKey, body: { value: "seen" } });
    saveState({ key: everKey, body: { value: selectedId } });
    onApply(selectedId);
    setVisible(false);
  };

  if (!visible) return null;

  const selected = personas.find((p) => p.id === selectedId) ?? personas[0];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99998, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@keyframes iq-ppmodal-in { from { opacity:0; transform:translateY(-20px) scale(0.97); } to { opacity:1; transform:none; } }`}</style>
      <div style={{ background: "rgba(10,14,28,0.98)", border: "1px solid rgba(69,137,255,0.3)", borderTop: "3px solid #4589FF", borderRadius: 14, width: "100%", maxWidth: 820, boxShadow: "0 24px 80px rgba(0,0,0,0.85),0 0 40px rgba(69,137,255,0.08)", animation: "iq-ppmodal-in 0.3s cubic-bezier(0.34,1.2,0.64,1)", overflow: "hidden", fontFamily: '"Inter",system-ui,sans-serif' }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,rgba(69,137,255,0.1) 0%,rgba(69,137,255,0.03) 100%)", borderBottom: "1px solid rgba(69,137,255,0.18)", padding: "28px 32px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ fontSize: 28 }}>🧭</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: BLUE, marginBottom: 4 }}>
                {isNewUser ? "Welcome" : `What's New in v${appVersion}`}
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
                {isNewUser ? APP_NAME : `${APP_NAME} v${appVersion}`}
              </h2>
            </div>
          </div>
          {isNewUser ? (
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.68)", lineHeight: 1.6, maxWidth: 600 }}>{APP_DESC}</p>
          ) : (
            <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
              {whatsNew.map((item, i) => (
                <li key={i} style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 4, display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ color: BLUE, flexShrink: 0 }}>✦</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "24px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          {/* Left: persona grid */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>Select Your Role</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {personas.map((p) => {
                const active = selectedId === p.id;
                return (
                  <button key={p.id} onClick={() => setSelectedId(p.id)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: active ? "rgba(69,137,255,0.18)" : "rgba(255,255,255,0.04)", border: `1px solid ${active ? "rgba(69,137,255,0.6)" : "rgba(255,255,255,0.1)"}`, color: "#fff", textAlign: "left", transition: "all 0.15s", boxShadow: active ? "0 0 12px rgba(69,137,255,0.15)" : "none" }}>
                    <span style={{ fontSize: 22, marginBottom: 4 }}>{p.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: active ? "#7ab4ff" : "rgba(255,255,255,0.9)" }}>{p.label}</span>
                    <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.42)", marginTop: 2, lineHeight: 1.4 }}>{p.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: what you'll see + continue */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>
                {selected.icon} What You'll See as {selected.label}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", lineHeight: 1.6, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.08)" }}>
                {selected.tabSummary}
              </div>
              <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(69,137,255,0.06)", borderRadius: 6, border: "1px solid rgba(69,137,255,0.15)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(69,137,255,0.9)", marginBottom: 4 }}>NavigatorIQ Assessment includes:</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                  🔴 Critical issues requiring immediate action<br />
                  🟡 Areas to monitor and investigate<br />
                  🟢 Healthy metrics with context<br />
                  📈 Trend vs previous period · Forecast engine · Direct app links
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
                Switch personas anytime using the role chip in the header. Customize app links and thresholds in <strong style={{ color: "rgba(255,255,255,0.55)" }}>Settings</strong>.
              </div>
            </div>
            <div style={{ marginTop: "auto" }}>
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 16 }} />
              <button onClick={handleContinue} onMouseEnter={() => setHoverBtn(true)} onMouseLeave={() => setHoverBtn(false)} style={{ width: "100%", padding: "13px 24px", background: hoverBtn ? "linear-gradient(135deg,#5599ff 0%,#2d6ef5 100%)" : "linear-gradient(135deg,#4589FF 0%,#1e5de0 100%)", border: `1px solid ${hoverBtn ? "#6aabff" : "#4589FF"}`, borderRadius: 8, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", letterSpacing: "0.02em", boxShadow: hoverBtn ? "0 4px 20px rgba(69,137,255,0.4)" : "0 2px 8px rgba(0,0,0,0.4)", transition: "all 0.15s ease" }}>
                {selected.icon} Continue as {selected.label} →
              </button>
              <div style={{ marginTop: 10, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.28)" }}>
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Unofficial community app — not supported by Dynatrace</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
