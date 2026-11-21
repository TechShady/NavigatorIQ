import React, { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ForecastModal } from "./ForecastModal";
import { KpiHeatmapPanel } from "./KpiHeatmapPanel";
import { DimensionModal } from "./DimensionModal";
import type { DimSlice } from "./DimensionModal";
import { getDqlDimensions, getDqlHistory } from "./DqlDrillData";
import type { DqlDrillContext } from "./DqlDrillData";
import { aggregateDqlDimensions } from "../queries";

export function DqlSharedPanel({ type, context, label, onClose }: { type: "forecast" | "heatmap" | "dimension"; context: DqlDrillContext; label: string; onClose: () => void }) {
  const [pos, setPos] = useState(() => ({ x: Math.max(20, window.innerWidth / 2 - 176), y: 30 }));
  const pendingDimensions = useRef<Promise<Record<string, unknown>[]> | null>(null);
  const onDragStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const startX = event.clientX, startY = event.clientY, initial = pos;
    const move = (e: MouseEvent) => setPos({ x: initial.x + e.clientX - startX, y: initial.y + e.clientY - startY });
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [pos]);
  const history = (days: number, minutes: number) => getDqlHistory(context, days, minutes);
  const dimensions = () => {
    if (!pendingDimensions.current) pendingDimensions.current = getDqlDimensions(context);
    return pendingDimensions.current;
  };
  const slices = async (field: "country" | "os"): Promise<DimSlice[]> => {
    const records = await dimensions();
    return aggregateDqlDimensions(records, field);
  };
  if (type === "forecast") return createPortal(<ForecastModal label={label} sparkline={[]} fromMs={0} toMs={0} onClose={onClose} getRequeryData={history} />, document.body);
  if (type === "heatmap") return <KpiHeatmapPanel label={label} pos={pos} onDragStart={onDragStart} onClose={onClose} getRequeryData={async (days) => ({ ...await history(days, 60), unit: context.metric.displayUnit === "pct" ? "%" : ["ms", "ns->ms", "µs->ms"].includes(context.metric.displayUnit ?? "") ? "ms" : context.metric.displaySuffix })} neutralAnalysis />;
  const firstTitle = context.mobileSession || context.errorFrontend ? "Country" : context.metric.drilldownDimensionFirstLabel?.trim() || "Country";
  const secondTitle = context.mobileSession || context.errorFrontend ? "Operating system" : context.metric.drilldownDimensionSecondLabel?.trim() || "Operating system";
  return <DimensionModal label={label} onClose={onClose} fetchGeo={() => slices("country")} fetchBrowser={() => slices("os")} strictData firstTitle={firstTitle} secondTitle={secondTitle} description={`${firstTitle} & ${secondTitle} · selected timeframe${context.errorFrontend ? " · error events may differ from metric counts" : ""}`} />;
}
