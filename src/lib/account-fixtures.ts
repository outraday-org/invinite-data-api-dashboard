import type { V2Me, V2Usage } from "@/lib/api/types";

/** `/v1/me` of a PRO account (the contract's example). Tests only. */
export const ME_PRO: V2Me = {
    account: { id: "acct_7f3a9c21", name: "Example Capital" },
    allowed_families: ["Companies", "Earnings calls", "SEC Filings"],
    credits: { included: 4_000_000, prepaid_balance_usd: 0, remaining: 3_728_983, resets_at: "2026-11-28T12:43:10.000Z", used: 271_017 },
    limits: { requests_per_minute: 1000, requests_per_second: 100 },
    plan: "pro",
};

/** `/v1/me` of a pay-as-you-go account (credits without a plan; Data API 10.0). Tests only. */
export const ME_PAYG: V2Me = {
    account: { id: "acct_2b81d07e", name: "Example Research" },
    allowed_families: ["Companies", "Earnings calls", "SEC Filings"],
    credits: { included: 500, prepaid_balance_usd: 25, remaining: 498, resets_at: "2026-12-01T00:00:00.000Z", used: 2 },
    limits: { requests_per_minute: 100, requests_per_second: 10 },
    plan: "payg",
};

const zero = { "4xx": 0, "5xx": 0, "402": 0, "403": 0, "429": 0 };

/** `/v1/me/usage?days=7`: three active days, two families, a key and an OAuth caller. Tests only. */
export const USAGE_7D: V2Usage = {
    by_family: [
        { credits: 199_585, family: "sec_filings", label: "SEC Filings", requests: 6454 },
        { credits: 1200, family: "earnings", label: "Earnings calls", requests: 1200 },
    ],
    by_key: [
        { caller: "key", credits: 96_434, key_hint: "invd_3f2...a91c", label: "Research key", requests: 3081 },
        { caller: "oauth", credits: 2000, key_hint: null, label: "Signed-in user", requests: 40 },
    ],
    daily: [
        { credits: 0, date: "2026-11-15", errors: zero, requests: 0 },
        { credits: 0, date: "2026-11-16", errors: zero, requests: 0 },
        { credits: 0, date: "2026-11-17", errors: zero, requests: 0 },
        { credits: 0, date: "2026-11-18", errors: zero, requests: 0 },
        { credits: 120_000, date: "2026-11-19", errors: { ...zero, 429: 3 }, requests: 4000 },
        { credits: 60_000, date: "2026-11-20", errors: zero, requests: 2000 },
        { credits: 20_785, date: "2026-11-21", errors: { ...zero, "4xx": 2 }, requests: 1654 },
    ],
    period: { included_credits: 4_000_000, prepaid_balance_usd: 0, resets_at: "2026-11-28T12:43:10.000Z", tier: "pro", used_credits: 271_017 },
    truncated: false,
    window_days: 7,
};
