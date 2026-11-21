import { queryExecutionClient } from "@dynatrace-sdk/client-query";
import type { HeatMetricConfig } from "../types";
import { DEFAULT_HEAT_METRICS } from "../constants";
import { buildDqlDetailQuery, buildMobileErrorDetailQuery, buildMobileSessionDetailQuery, dqlHistoryChunks, parseDqlHistory, parseMetricTimeline, resolveDqlTimeframeEnd } from "../queries";

export interface DqlDrillContext {
  metric: HeatMetricConfig;
  row: string;
  mobileSession: boolean;
  errorFrontend?: string;
  errorType?: string | null;
  from: string;
  to: string;
}

export function usesMobileSessionRows(ctx: DqlDrillContext): boolean {
  return ctx.mobileSession || DEFAULT_HEAT_METRICS.mobile.some(metric => metric.drilldownQuery === ctx.metric.drilldownQuery);
}

export async function executeDetailQuery(query: string): Promise<Record<string, unknown>[]> {
  const start = await queryExecutionClient.queryExecute({ body: { query, requestTimeoutMilliseconds: 30000 } });
  let response = start;
  const deadline = Date.now() + 180000;
  while (response.state === "RUNNING" || response.state === "NOT_STARTED") {
    if (!start.requestToken) throw new Error("Query is running but did not return a polling token.");
    if (Date.now() >= deadline) throw new Error("Query timed out while waiting for results.");
    response = await queryExecutionClient.queryPoll({ requestToken: start.requestToken, requestTimeoutMilliseconds: 10000 });
    if (response.state === "RUNNING" || response.state === "NOT_STARTED") await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (response.state !== "SUCCEEDED" || !response.result) throw new Error(`Query did not succeed (${response.state}).`);
  if (response.result.records.some(record => record === null)) throw new Error("Query returned an invalid record.");
  return response.result.records.filter((record): record is NonNullable<typeof record> => record !== null);
}

export async function getDqlHistory(ctx: DqlDrillContext, days: number, minutes: number): Promise<{ values: number[]; bucketMs: number; startMs: number; endMs: number }> {
  const bucketMs = minutes * 60000;
  const now = Date.now();
  const selectedEnd = resolveDqlTimeframeEnd(ctx.to, now);
  const delayedEnd = usesMobileSessionRows(ctx) ? Math.min(selectedEnd, now - 2 * 3600000) : selectedEnd;
  const endMs = Math.floor(delayedEnd / bucketMs) * bucketMs;
  const startMs = endMs - days * 86400000;
  const values: number[] = [];
  for (const { startMs: chunkStart, endMs: chunkEnd } of dqlHistoryChunks(startMs, endMs, bucketMs)) {
    const from = JSON.stringify(new Date(chunkStart).toISOString());
    const to = JSON.stringify(new Date(chunkEnd).toISOString());
    const interval = `${minutes}m`;
    const query = ctx.mobileSession
      ? buildMobileSessionDetailQuery(ctx.row, from, to, "history", interval)
      : ctx.errorFrontend && ctx.errorType !== undefined
        ? buildMobileErrorDetailQuery(ctx.errorFrontend, ctx.errorType, from, to, "history", interval)
        : ctx.metric.drilldownHistoryQuery?.trim()
          ? buildDqlDetailQuery(ctx.metric.drilldownHistoryQuery, ctx.row, from, to, interval)
          : undefined;
    if (!query) throw new Error("Configure a per-row history DQL query in metric settings.");
    const records = await executeDetailQuery(query);
    values.push(...parseDqlHistory(records, chunkStart, chunkEnd, bucketMs));
  }
  return { values: parseMetricTimeline(values, ctx.metric.displayUnit), bucketMs, startMs, endMs };
}

export async function getDqlDimensions(ctx: DqlDrillContext): Promise<Record<string, unknown>[]> {
  const query = ctx.mobileSession
    ? buildMobileSessionDetailQuery(ctx.row, ctx.from, ctx.to, "dimension")
    : ctx.errorFrontend && ctx.errorType !== undefined
      ? buildMobileErrorDetailQuery(ctx.errorFrontend, ctx.errorType, ctx.from, ctx.to, "dimension")
      : ctx.metric.drilldownDimensionQuery?.trim()
        ? buildDqlDetailQuery(ctx.metric.drilldownDimensionQuery, ctx.row, ctx.from, ctx.to)
        : undefined;
  if (!query) throw new Error("Configure a per-row dimension DQL query in metric settings.");
  return executeDetailQuery(query);
}
