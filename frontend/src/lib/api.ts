const PROD_API_FALLBACK = "https://hypd-games-production.up.railway.app";

function normalizeApiUrl(url?: string): string {
  return (url || "").trim().replace(/\/+$/, "");
}

const configuredApiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);

export const API_URL =
  configuredApiUrl || (process.env.NODE_ENV === "production" ? PROD_API_FALLBACK : "");
