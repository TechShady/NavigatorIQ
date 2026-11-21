const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveFtrLink } = require("./ftrLinks.ts");
const { resolvePersonaHeatMetrics } = require("./constants.ts");

test("a fresh Mobile Experience profile launches Mobile Navigation from every metric", () => {
  const metrics = resolvePersonaHeatMetrics("mobile");
  assert.deepEqual(metrics.map(metric => metric.label), ["Sessions", "Errors", "Error Rate", "Crashes", "Crash Rate"]);
  for (const metric of metrics) {
    assert.equal(metric.exploreAppPath, "my.mobile.navigation.app");
    const link = resolveFtrLink(metric.drilldownLinkTemplate, "App & Mobile", "https://example.apps.dynatrace.com");
    assert.equal(link.url, "https://example.apps.dynatrace.com/ui/apps/my.mobile.navigation.app/?app=App%20%26%20Mobile");
  }
});

test("saved mobile settings inherit missing links but keep custom URLs and explicit opt-outs", () => {
  const [sessions, errors, errorRate] = resolvePersonaHeatMetrics("mobile");
  const { drilldownLinkTemplate, ...oldSessions } = sessions;
  const [inherited, customized, optedOut] = resolvePersonaHeatMetrics("mobile", [
    { ...oldSessions, warningThreshold: 10 },
    { ...errors, drilldownLinkTemplate: "my.other.app/?app=${row}" },
    { ...errorRate, drilldownLinkTemplate: "" },
  ]);
  assert.equal(inherited.drilldownLinkTemplate, drilldownLinkTemplate);
  assert.equal(inherited.warningThreshold, 10);
  assert.equal(customized.drilldownLinkTemplate, "my.other.app/?app=${row}");
  assert.equal(resolveFtrLink(optedOut.drilldownLinkTemplate, "App", "https://example.apps.dynatrace.com"), undefined);
});

test("FTR row links use the current tenant and selected display name", () => {
  for (const tenant of ["lfa60087", "guu84124"]) {
    const environment = `https://${tenant}.apps.dynatrace.com`;
    assert.deepEqual(resolveFtrLink("my.mobile.navigation.app/?app=${row}", "L1158_mobile", environment), {
      url: `${environment}/ui/apps/my.mobile.navigation.app/?app=L1158_mobile`,
    });
  }
});

test("row names are encoded as a single value without injecting parameters or fragments", () => {
  const row = 'Mobile & Web / München?tab=other#detail%${row}';
  const result = resolveFtrLink("my.mobile.navigation.app/?app=${row}&view=errors#overview", row, "https://lfa60087.apps.dynatrace.com");
  assert.ok(result && "url" in result);
  const url = new URL(result.url);
  assert.equal(url.searchParams.get("app"), row);
  assert.equal(url.searchParams.get("view"), "errors");
  assert.equal(url.searchParams.has("tab"), false);
  assert.equal(url.hash, "#overview");
});

test("templates support repeated placeholders and app routes without double encoding", () => {
  const result = resolveFtrLink("my.app/details/${row}?selected=${row}", "A/B & C", "https://guu84124.apps.dynatrace.com/");
  assert.deepEqual(result, { url: "https://guu84124.apps.dynatrace.com/ui/apps/my.app/details/A%2FB%20%26%20C?selected=A%2FB%20%26%20C" });
});

test("unconfigured FTR links leave existing navigation untouched", () => {
  assert.equal(resolveFtrLink(undefined, "A", "https://example.invalid"), undefined);
  assert.equal(resolveFtrLink("   ", "A", "https://example.invalid"), undefined);
});

test("invalid templates and missing row context return explicit diagnostics", () => {
  for (const template of [
    "my.app/?app=fixed",
    "my.app/?app=${app.name}",
    "my.app/?app=${row}&extra=${from}",
    "my.app/?app=${row}&extra=${unfinished",
    "https://other.invalid/my.app/?app=${row}",
    "//other.invalid/my.app/?app=${row}",
    "/ui/apps/my.app/?app=${row}",
    "javascript:alert('${row}')",
    "my.app\\?app=${row}",
    "my.app/\n?app=${row}",
    "my.app/\0?app=${row}",
    "my.app/../../other/?app=${row}",
    "my.app/%2e%2e/other/?app=${row}",
  ]) {
    const result = resolveFtrLink(template, "A", "https://example.invalid");
    assert.ok(result && "error" in result, template);
    assert.ok(result.error.length > 0);
  }
  assert.match(resolveFtrLink("my.app/?app=${row}", " ", "https://example.invalid").error, /no name/);
  assert.match(resolveFtrLink("my.app/?app=${row}", "\uD800", "https://example.invalid").error, /URL-encoded/);
  assert.match(resolveFtrLink("my.app/${row}", "..", "https://example.invalid").error, /target app path/);
  assert.match(resolveFtrLink("my.app/details/${row}", ".", "https://example.invalid").error, /dot-segment/);
  assert.match(resolveFtrLink("my.app/?app=${row}", "A", "").error, /environment URL/);
  assert.match(resolveFtrLink("my.app/?app=${row}", "A", "file:///C:/test").error, /HTTP or HTTPS/);
});
