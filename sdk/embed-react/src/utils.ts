export function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, "");
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function httpToWs(url: string): string {
  return url.replace(/^http/, "ws");
}
