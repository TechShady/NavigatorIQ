import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";
import { queryExecutionClient } from "@dynatrace-sdk/client-query";

// ─── Entity type config ──────────────────────────────────────────────────────

interface EntityConfig {
  entityField: string;
  nameField?: string;    // secondary dimension (e.g. useraction.name for RUM)
  appPath: string;
  appLabel: string;
}

function detectEntityConfig(metricKey: string): EntityConfig | null {
  if (metricKey.startsWith("dt.service.")) {
    return { entityField: "dt.entity.service", appPath: "dynatrace.services", appLabel: "Services" };
  }
  if (metricKey.startsWith("dt.rum.") || metricKey.startsWith("dt.frontend.")) {
    return { entityField: "dt.entity.browser_application", nameField: "useraction.name", appPath: "dynatrace.digital.experience", appLabel: "Digital Experience" };
  }
  if (metricKey.startsWith("dt.host.") || metricKey.startsWith("dt.network.")) {
    return { entityField: "dt.entity.host", appPath: "dynatrace.classic.hosts", appLabel: "Hosts" };
  }
  if (metricKey.startsWith("dt.database_service.") || metricKey.startsWith("dt.db.")) {
    return { entityField: "dt.entity.database_service", appPath: "dynatrace.databases", appLabel: "Databases" };
  }
  if (metricKey.startsWith("dt.kubernetes.") || metricKey.startsWith("dt.k8s.")) {
    return { entityField: "dt.entity.cloud_application_namespace", appPath: "dynatrace.kubernetes", appLabel: "Kubernetes" };
  }
  return null;
}

function buildExploreQuery(metricKey: string, entityField: string, nameField: string | undefined, from: string, to: string): string {
  const alias = "val";
  const dims = nameField ? `{${entityField}, ${nameField}}` : `{${entityField}}`;
  const fieldList = nameField ? `${entityField}, ${nameField}, avgValue` : `${entityField}, avgValue`;
  return (
    `timeseries ${alias}=avg(${metricKey}), from:${from}, to:${to}, by:${dims}` +
    `\n| fieldsAdd avgValue=arrayAvg(${alias})` +
    `\n| fields ${fieldList}` +
    `\n| sort avgValue desc` +
    `\n| limit 10`
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function entityDisplayName(raw: any): { display: string; id: string } {
  if (!raw) return { display: "Unknown", id: "" };
  if (typeof raw === "object" && raw !== null) {
    const name = (raw["name"] as string | undefined) ?? "";
    const id = (raw["id"] as string | undefined) ?? String(raw);
    return { display: name || id, id };
  }
  const s = String(raw);
  return { display: s, id: s };
}

function formatValue(v: unknown): string {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function openEntity(envUrl: string, appPath: string, entityId: string) {
  const filter = entityId ? `&entitySelector=entityId(${entityId})` : "";
  try {
    window.open(`${envUrl}/ui/apps/${appPath}?gtf=-2h${filter}`, "_blank");
  } catch {
    window.open(`/ui/apps/${appPath}?gtf=-2h${filter}`, "_blank");
  }
}

// ─── Row shape ───────────────────────────────────────────────────────────────

interface EntityRow { display: string; id: string; sub?: string; avgValue: number }

// ─── Component ───────────────────────────────────────────────────────────────

interface ExploreModalProps {
  metricKey: string;
  metricLabel: string;
  from: string;
  to: string;
  onClose: () => void;
}

export function ExploreModal({ metricKey, metricLabel, from, to, onClose }: ExploreModalProps) {
  const [rows, setRows] = useState<EntityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cfg = detectEntityConfig(metricKey);

  useEffect(() => {
    if (!cfg) return;
    setRows(null);
    setError(null);
    const q = buildExploreQuery(metricKey, cfg.entityField, cfg.nameField, from, to);
    queryExecutionClient
      .queryExecute({ body: { query: q, requestTimeoutMilliseconds: 30000 } })
      .then((res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const records: any[] = (res.result as any)?.records ?? [];
        const parsed: EntityRow[] = records
          .map((rec) => {
            const entity = entityDisplayName(rec[cfg.entityField]);
            const sub = cfg.nameField ? String(rec[cfg.nameField] ?? "") : undefined;
            const avgValue = Number(rec["avgValue"] ?? 0);
            return { display: entity.display, id: entity.id, sub: sub || undefined, avgValue };
          })
          .filter((r) => r.display && r.display !== "Unknown");
        setRows(parsed);
      })
      .catch((e) => setError(String(e)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricKey, from, to]);

  let envUrl = "";
  try { envUrl = getEnvironmentUrl(); } catch { /* noop */ }

  const modal = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#1A1D23", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, width: 480, maxWidth: "92vw", maxHeight: "70vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#E0E6F0" }}>Follow the Red — {metricLabel}</div>
            {cfg && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Top impacted {cfg.appLabel.toLowerCase()} · click row to open in DT</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "10px 0" }}>
          {!cfg && (
            <div style={{ padding: "20px 16px", color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center" }}>
              No entity drill-down available for custom DQL metrics.
            </div>
          )}
          {cfg && rows === null && !error && (
            <div style={{ padding: "24px 16px", color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center" }}>
              Querying {cfg.appLabel.toLowerCase()}…
            </div>
          )}
          {cfg && error && (
            <div style={{ padding: "20px 16px", color: "#F87171", fontSize: 12 }}>Query failed: {error}</div>
          )}
          {cfg && rows !== null && rows.length === 0 && (
            <div style={{ padding: "20px 16px", color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center" }}>No data returned for this metric in the selected timeframe.</div>
          )}
          {cfg && rows !== null && rows.map((row, i) => (
            <div
              key={i}
              onClick={() => openEntity(envUrl, cfg.appPath, row.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", cursor: "pointer", transition: "background 0.1s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(69,137,255,0.07)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              {/* Rank */}
              <div style={{ width: 20, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{i + 1}</div>
              {/* Entity name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#C9D8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.display}</div>
                {row.sub && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.sub}</div>}
              </div>
              {/* Value */}
              <div style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? "#FF3D9A" : i < 3 ? "#FFF04D" : "#10B981", flexShrink: 0 }}>{formatValue(row.avgValue)}</div>
              {/* Arrow */}
              <div style={{ fontSize: 12, color: "rgba(69,137,255,0.6)", flexShrink: 0 }}>↗</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {cfg && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => openEntity(envUrl, cfg.appPath, "")}
              style={{ background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.3)", borderRadius: 6, color: "#7ab4ff", fontSize: 12, padding: "5px 12px", cursor: "pointer" }}
            >
              Open {cfg.appLabel} →
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
