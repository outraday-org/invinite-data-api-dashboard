/**
 * Pricing posture of the licensing page (proposal 12.3). Prices are literal `$X` placeholders in this
 * one constant so a later edit is one line; the licence rights per tier come from the API's
 * `GET /status/licensing`, never from here.
 */
export const PRICE_PLACEHOLDER = "$X/mo";

export type PricingTier = {
    name: string;
    price: string;
    includes: Array<string>;
};

export const SELF_SERVE_TIERS: Array<PricingTier> = [
    {
        includes: ["Earnings-call transcripts and events", "Calendar, live status, participants"],
        name: "Transcripts + events",
        price: PRICE_PLACEHOLDER,
    },
    {
        includes: ["Everything in Transcripts + events", "Audio, slides, structured data, transcript versions"],
        name: "+ audio, slides, structured data, versions",
        price: PRICE_PLACEHOLDER,
    },
    {
        includes: ["Everything above", "Live audio stream and webhooks"],
        name: "+ live stream and webhooks",
        price: PRICE_PLACEHOLDER,
    },
];

export const ENTERPRISE_TIER: PricingTier = {
    includes: ["Broader redistribution terms (still inside your product, with attribution — never resale)", "Training rights (contract-only)", "SLAs"],
    name: "Enterprise",
    price: "Contact us",
};

export const VOLUME_PRICING_NOTE
    = "Structured products (extractions, guidance history, metrics, financial statements) are also available with per-call volume pricing.";
