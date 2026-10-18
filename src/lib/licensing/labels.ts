import type { LicenseRight, LicenseTier, LicensingFamily } from "@/lib/api/types";

/** Display labels of the API's product families (licensing page). */
export const FAMILY_LABELS: Record<LicensingFamily["family"], string> = {
    account: "Account",
    company: "Company",
    earnings_calls: "Earnings calls",
    financials: "Financials",
    insider_trades: "Insider trades",
    institutional_ownership: "Institutional ownership",
    ipos: "IPOs",
    market: "Market",
    metadata: "Metadata",
    sec_filings: "SEC filings",
    websocket: "WebSocket",
};

export const RIGHT_LABELS: Record<LicenseRight, string> = {
    audio: "Audio",
    display: "Display",
    rag: "RAG",
    redistribute: "Redistribute",
    resell: "Resell",
    train: "Train",
};

export const LICENSE_TIERS = ["free", "lite", "standard", "pro"] as const satisfies ReadonlyArray<LicenseTier>;

export const TIER_LABELS: Record<LicenseTier, string> = {
    free: "Free",
    lite: "Lite",
    pro: "Pro",
    standard: "Standard",
};

const TOP_SCOPE = /^top(\d+)$/;

/**
 * The earnings-call coverage scope in words: `top500` → "the top 500 US companies by market cap",
 * `all` → "all US-listed companies"; null for `unknown` or any other value.
 */
export function describeEarningsScope(scope: string) {
    if (scope === "all") return "all US-listed companies";

    const match = TOP_SCOPE.exec(scope);

    if (!match) return null;

    return `the top ${Number(match[1]).toLocaleString("en")} US companies by market cap`;
}
