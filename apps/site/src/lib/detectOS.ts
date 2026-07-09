export type OS = "mac" | "windows" | "linux" | "unknown";

export function detectOS(): OS {
  // Prefer the modern User-Agent Client Hints API (Chromium-based browsers)
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  if (uaData?.platform) {
    if (uaData.platform === "macOS") return "mac";
    if (uaData.platform === "Windows") return "windows";
    if (uaData.platform === "Linux") return "linux";
  }
  // Fall back to the classic User-Agent string
  const ua = navigator.userAgent;
  if (/Macintosh|MacIntel|Mac OS X/.test(ua)) return "mac";
  if (/Windows/.test(ua)) return "windows";
  if (/Linux/.test(ua) && !/Android/.test(ua)) return "linux";
  return "unknown";
}
