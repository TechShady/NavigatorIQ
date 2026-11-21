type FtrLinkResult = { url: string } | { error: string };

export function resolveFtrLink(template: string | undefined, row: string, environmentUrl: string): FtrLinkResult | undefined {
  const path = template?.trim();
  if (!path) return undefined;
  if (!path.includes("${row}")) return { error: "FTR Link Template must include ${row}." };
  if (path.replace(/\$\{row\}/g, "").includes("${")) return { error: "Only the ${row} placeholder is supported in FTR links." };
  const appId = /^([a-zA-Z0-9][a-zA-Z0-9._-]*)(?=[/?#]|$)/.exec(path)?.[1];
  const hasControlCharacters = Array.from(path).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
  if (!appId || /[\s\\]/.test(path) || hasControlCharacters) {
    return { error: "Use an app-relative path such as my.mobile.navigation.app/?app=${row}, without a hostname, leading slash, spaces or backslashes." };
  }
  if (!row.trim()) return { error: "This row has no name to pass to the target app." };

  let encodedRow: string;
  try {
    encodedRow = encodeURIComponent(row);
  } catch (error) {
    if (error instanceof URIError) return { error: "This row name cannot be URL-encoded." };
    throw error;
  }
  let environment: URL;
  try {
    environment = new URL(environmentUrl);
  } catch (error) {
    if (error instanceof TypeError) return { error: "The current Dynatrace environment URL is unavailable." };
    throw error;
  }
  if (environment.protocol !== "https:" && environment.protocol !== "http:") {
    return { error: "The current Dynatrace environment URL must use HTTP or HTTPS." };
  }
  const appPath = path.replace(/\$\{row\}/g, () => encodedRow);
  if (appPath.split(/[?#]/, 1)[0].split("/").some(segment => /^(?:\.|%2e){1,2}$/i.test(segment))) {
    return { error: "FTR links must stay within the target app path; dot-segment navigation is not supported." };
  }
  const url = new URL(`/ui/apps/${appPath}`, environment.origin);
  const appRoot = `/ui/apps/${appId}`;
  if (url.pathname !== appRoot && !url.pathname.startsWith(`${appRoot}/`)) {
    return { error: "FTR links must stay within the target app path; parent-directory navigation is not supported." };
  }
  return { url: url.href };
}
