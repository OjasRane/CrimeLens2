import { demoInvestigation } from "@/data/investigations/demo";
import { mumbai2611Investigation } from "@/data/investigations/mumbai2611";

// A separate immutable snapshot entry. Never resolve arbitrary registry objects here.
export const publicCases = [demoInvestigation, mumbai2611Investigation] as const;
export function getPublicCase(id: string) {
  return publicCases.find((item) => item.id === id) ?? null;
}
export function safeReturnPath(value: string | null | undefined, fallback = "/cases") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://internal.invalid");
    if (url.origin !== "https://internal.invalid" || !["/cases", "/cases/new", "/workspace", "/dashboard", "/security", "/uplink"].includes(url.pathname)) return fallback;
    return url.pathname + url.search;
  } catch { return fallback; }
}
export function networkStorageKey(userId: string, investigationId: string) {
  return `crimelens-network-workspaces:v2:${encodeURIComponent(userId)}:${encodeURIComponent(investigationId)}`;
}
