import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";
import { queryExecutionClient } from "@dynatrace-sdk/client-query";

// ─── Entity config ───────────────────────────────────────────────────────────

interface EntityConfig {
  entityField: string;     // DQL grouping field (dt.entity.host, dt.entity.service, …)
  entityTable: string;     // entity fetch table for name lookup
  nameField?: string;      // secondary label (useraction.name for RUM)
  appLabel: string;        // fallback label for footer button
  fallbackAppPath: string; // app to open when no entity selected
  queryType: "timeseries" | "userevents";
  valueMultiplier?: number; // scale avg before display (e.g. 1/1000000 for ns→ms)
  valueUnit?: string;
  rumField?: string;       // user.events field to average (userevents mode)
}

function detectEntityConfig(metricKey: string): EntityConfig | null {
  // Service-level (includes DBA which uses dt.service.request.response_time)
  if (metricKey.startsWith("dt.service.")) {
    return {
      entityField: "dt.entity.service", entityTable: "dt.entity.service",
      appLabel: "Services", fallbackAppPath: "dynatrace.services",
      queryType: "timeseries",
      valueMultiplier: metricKey.includes("response_time") ? 1 / 1000000 : undefined,
      valueUnit: metricKey.includes("response_time") ? "ms" : undefined,
    };
  }
  // RUM / Digital Experience
  if (metricKey.startsWith("dt.rum.") || metricKey.startsWith("dt.frontend.")) {
    const rumFieldMap: Record<string, string> = {
      "dt.rum.useraction.duration": "useraction.duration",
      "dt.rum.useraction.largest_contentful_paint": "web_vitals.largest_contentful_paint",
      "dt.rum.useraction.time_to_first_byte": "web_vitals.time_to_first_byte",
      "dt.rum.useraction.first_contentful_paint": "web_vitals.first_contentful_paint",
      "dt.rum.error.count": "useraction.duration", // fallback: show slowest actions
    };
    return {
      entityField: "dt.entity.browser_application", entityTable: "dt.entity.browser_application",
      nameField: "useraction.name",
      appLabel: "Digital Experience", fallbackAppPath: "dynatrace.digital.experience",
      queryType: "userevents",
      rumField: rumFieldMap[metricKey] ?? "useraction.duration",
      valueMultiplier: 1 / 1000000, valueUnit: "ms",
    };
  }
  // Host / process / network (all host-level)
  if (metricKey.startsWith("dt.host.") || metricKey.startsWith("dt.process.") || metricKey.startsWith("dt.network.")) {
    return {
      entityField: "dt.entity.host", entityTable: "dt.entity.host",
      appLabel: "Infrastructure", fallbackAppPath: "dynatrace.infrastructure.observability",
      queryType: "timeseries",
      valueUnit: metricKey.includes("cpu") || metricKey.includes("mem") ? "%" : undefined,
    };
  }
  // Database
  if (metricKey.startsWith("dt.database_service.") || metricKey.startsWith("dt.db.")) {
    return {
      entityField: "dt.entity.service", entityTable: "dt.entity.service",
      appLabel: "Services", fallbackAppPath: "dynatrace.services",
      queryType: "timeseries",
      valueMultiplier: 1 / 1000000, valueUnit: "ms",
    };
  }
  // Kubernetes
  if (metricKey.startsWith("dt.kubernetes.") || metricKey.startsWith("dt.k8s.")) {
    return {
      entityField: "dt.entity.cloud_application_namespace", entityTable: "dt.entity.cloud_application_namespace",
      appLabel: "Kubernetes", fallbackAppPath: "dynatrace.kubernetes",
      queryType: "timeseries",
    };
  }
  return null;
}

// ─── Query builder ────────────────────────────────────────────────────────────

function buildExploreQuery(metricKey: string, cfg: EntityConfig, from: string, to: string): string {
  if (cfg.queryType === "userevents") {
    const rumField = cfg.rumField ?? "useraction.duration";
    const scale = cfg.valueMultiplier ?? 1;
    const scaleExpr = scale !== 1 ? `avg(${rumField})*${scale}` : `avg(${rumField})`;
    return (
      `fetch user.events, from:${from}, to:${to}\n` +
      `| filter dt.rum.user_type != "robot" and isNotNull(useraction.name)\n` +
      `| summarize avgValue=${scaleExpr},\n` +
      `    by:{entityId=toString(dt.entity.browser_application),\n` +
      `        displayName=coalesce(app.name, toString(dt.entity.browser_application)),\n` +
      `        sub=useraction.name}\n` +
      `| sort avgValue desc\n` +
      `| limit 10`
    );
  }

  const scale = cfg.valueMultiplier ?? 1;
  const scaleExpr = scale !== 1 ? `arrayAvg(val)*${scale}` : `arrayAvg(val)`;
  return (
    `timeseries val=avg(${metricKey}), from:${from}, to:${to}, by:{${cfg.entityField}}\n` +
    `| fieldsAdd entityId=toString(${cfg.entityField}), avg=${scaleExpr}\n` +
    `| sort avg desc\n` +
    `| limit 10\n` +
    `| lookup [fetch ${cfg.entityTable} | fields id, entity.name], sourceField:entityId, lookupField:id, prefix:"e."\n` +
    `| fieldsAdd displayName=if(isNotNull(e.entity.name), e.entity.name, entityId)\n` +
    `| fields entityId, displayName, avg`
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatVal(v: unknown, unit?: string): string {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  const suf = unit ? ` ${unit}` : "";
  if (unit === "ms") return `${n >= 1000 ? (n / 1000).toFixed(1) + "s" : n.toFixed(0) + "ms"}`;
  if (unit === "%") return `${n.toFixed(1)}%`;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M${suf}`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K${suf}`;
  return `${n.toFixed(1)}${suf}`;
}

function openEntity(envUrl: string, entityId: string, fallbackAppPath: string) {
  const url = entityId
    ? `${envUrl}/ui/entity/${entityId}`
    : `${envUrl}/ui/apps/${fallbackAppPath}`;
  try { window.open(url, "_blank"); }
  catch { window.open(url.replace(envUrl, ""), "_blank"); }
}

// ─── Row shape ───────────────────────────────────────────────────────────────

interface EntityRow { entityId: string; displayName: string; sub?: string; avgValue: number }

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
    const q = buildExploreQuery(metricKey, cfg, from, to);
    queryExecutionClient
      .queryExecute({ body: { query: q, requestTimeoutMilliseconds: 30000 } })
      .then((res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const records: any[] = (res.result as any)?.records ?? [];
        const parsed: EntityRow[] = records.map((rec) => ({
          entityId: String(rec["entityId"] ?? rec[cfg.entityField] ?? ""),
          displayName: String(rec["displayName"] ?? rec["entityId"] ?? "Unknown"),
          sub: rec["sub"] ? String(rec["sub"]) : undefined,
          avgValue: Number(rec["avg"] ?? rec["avgValue"] ?? 0),
        })).filter((r) => r.entityId || r.displayName !== "Unknown");
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
      <div style={{ background: "#1A1D23", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, width: 500, maxWidth: "94vw", maxHeight: "72vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#E0E6F0" }}>Follow the Red — {metricLabel}</div>
            {cfg && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Top impacted {cfg.appLabel.toLowerCase()} · click row to open in Dynatrace</div>}
            {!cfg && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Custom DQL metric — no entity drill-down available</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
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
              onClick={() => openEntity(envUrl, row.entityId, cfg.fallbackAppPath)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(69,137,255,0.07)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <div style={{ width: 20, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#C9D8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.displayName}</div>
                {row.sub && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.sub}</div>}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? "#FF3D9A" : i < 3 ? "#FFF04D" : "#10B981", flexShrink: 0 }}>
                {formatVal(row.avgValue, cfg.valueUnit)}
              </div>
              <div style={{ fontSize: 12, color: "rgba(69,137,255,0.6)", flexShrink: 0 }}>↗</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {cfg && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => openEntity(envUrl, "", cfg.fallbackAppPath)}
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
