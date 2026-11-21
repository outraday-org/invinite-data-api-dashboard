import type { LucideIcon } from "lucide-react";

import {
    ActivityIcon,
    ArrowUpRightIcon,
    BarChart3Icon,
    BriefcaseIcon,
    BuildingIcon,
    CalendarDaysIcon,
    CalendarOffIcon,
    ChartPieIcon,
    CircleUserRoundIcon,
    CoinsIcon,
    ContactIcon,
    FileTextIcon,
    FolderOpenIcon,
    HandCoinsIcon,
    HistoryIcon,
    HouseIcon,
    IdCardIcon,
    LandmarkIcon,
    LayersIcon,
    LayoutDashboardIcon,
    ListIcon,
    LockKeyholeIcon,
    MicIcon,
    NewspaperIcon,
    PieChartIcon,
    RadioIcon,
    ReceiptIcon,
    RocketIcon,
    ScaleIcon,
    SplitIcon,
    UserRoundIcon,
    UsersIcon,
} from "lucide-react";

import type { V2Dataset, V2FilerResponse, V2Instrument } from "@/lib/api/types";
import type { FileRoutesByTo } from "@/routeTree.gen";

import { INSTRUMENT_TYPE_LABELS, servesSection } from "@/lib/instruments";
import { PERSON_ANCHORS } from "@/lib/people";
import { LICENSING_PAGE_URL, STATUS_PAGE_URL } from "@/lib/public-hosts";

/**
 * THE navigation table (backend tasks/data-api-dashboard O5): the sidebar, the landing page's cards and the search's
 * "Pages" group all read it, so a new top-level route is added here once, in the commit of its route
 * (`route-names.test.ts` fails for a top-level route without an entry).
 */

/** A path of the route tree without parameters (a top-level page). */
export type PagePath = Exclude<keyof FileRoutesByTo, `${string}$${string}`>;

export type NavPage = {
    /** One line for the landing page's cards and the search's "Pages" group. */
    description: string;
    icon: LucideIcon;
    /** Extra words the search's "Pages" group matches ("ipos" → IPO calendar). */
    keywords: ReadonlyArray<string>;
    label: string;
    to: PagePath;
};

/** Market: always shown. */
export const MARKET_NAV: ReadonlyArray<NavPage> = [
    { description: "Live calls, today's earnings, next IPOs and holidays.", icon: HouseIcon, keywords: ["home", "start", "landing"], label: "Home", to: "/" },
    { description: "Earnings calls of every covered US company by day.", icon: CalendarDaysIcon, keywords: ["calendar", "earnings", "calls", "events"], label: "Earnings calendar", to: "/calendar" },
    { description: "Every earnings call live right now.", icon: RadioIcon, keywords: ["live", "now", "calls", "audio"], label: "Live calls", to: "/live-calls" },
    { description: "Offerings from SEC registration to listing.", icon: RocketIcon, keywords: ["ipo", "ipos", "offerings", "listings", "spac"], label: "IPOs", to: "/ipo-calendar" },
    { description: "US exchange holidays and early closes.", icon: CalendarOffIcon, keywords: ["holidays", "closed", "market", "exchange"], label: "Market holidays", to: "/market-holidays" },
];

/** Browse: always shown. Later tasks add News feed, Filings, Offerings, Search, Catalog, Alerts here with their routes. */
export const BROWSE_NAV: ReadonlyArray<NavPage> = [
    { description: "Every exchange-traded US symbol: stocks, ETFs, closed-end funds, ETNs.", icon: ListIcon, keywords: ["instruments", "stocks", "symbols", "tickers", "etn", "etns", "browse"], label: "Instruments", to: "/instruments" },
    { description: "Every listed ETF and closed-end fund with net assets.", icon: LayersIcon, keywords: ["funds", "etf", "etfs", "closed-end", "holdings"], label: "Funds", to: "/funds" },
    { description: "13F investment managers and their portfolios.", icon: LandmarkIcon, keywords: ["institutions", "managers", "13f", "holders", "filers"], label: "Institutions", to: "/institutions" },
    { description: "Executives and analysts who speak on calls, with every call of each.", icon: ContactIcon, keywords: ["people", "persons", "executives", "analysts", "speakers", "participants"], label: "People", to: "/people" },
];

/** The account (bottom of the sidebar, with the plan badge). */
export const ACCOUNT_NAV: NavPage = {
    description: "Your plan, credits and usage.",
    icon: CircleUserRoundIcon,
    keywords: ["account", "plan", "credits", "usage", "billing", "key"],
    label: "Account",
    to: "/account",
};

export type HelpLink = { description: string; href: string; icon: LucideIcon; keywords: ReadonlyArray<string>; label: string };

/** Help (bottom of the sidebar): public pages on other hosts; `/status` and `/licensing` redirect there. */
export const HELP_NAV: ReadonlyArray<HelpLink> = [
    { description: "Measured availability, latency and reachability of the API.", href: STATUS_PAGE_URL, icon: ActivityIcon, keywords: ["status", "uptime", "health"], label: "API status" },
    { description: "What each plan may do with the data, per route.", href: LICENSING_PAGE_URL, icon: ScaleIcon, keywords: ["licensing", "license", "terms"], label: "Licensing" },
];

/** Every page of the navigation table. */
export const NAV_PAGES: ReadonlyArray<NavPage> = [...MARKET_NAV, ...BROWSE_NAV, ACCOUNT_NAV];

/**
 * Top-level route files without an entry, with the reason (`route-names.test.ts`): server routes that answer a redirect
 * to another host (reached through `HELP_NAV`), and `/sec/$cik` (a filer page, reached by search and links).
 */
export const NAV_EXCEPTIONS: Readonly<Record<string, string>> = {
    "/licensing": "301 server route to the licensing matrix (HELP_NAV)",
    "/sec": "parameterised filer pages (/sec/$cik), reached by search and links",
    "/status": "301 server route to the status page (HELP_NAV)",
};

/** The search's "Pages" group: the entries whose label, path or keywords contain every typed word (no request). */
export function searchPages(query: string): Array<HelpLink | NavPage> {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

    if (words.length === 0) return [];

    const all: Array<HelpLink | NavPage> = [...NAV_PAGES, ...HELP_NAV];

    return all.filter((entry) => {
        const haystack = [entry.label, "to" in entry ? entry.to : "", ...entry.keywords].join(" ").toLowerCase();

        return words.every(word => haystack.includes(word));
    });
}

// Context: the open subject.

/** A `/$ticker` section path (the overview is "/$ticker"). */
export type TickerPath = Extract<keyof FileRoutesByTo, `/$ticker${string}`>;

export type InstrumentSection = { icon: LucideIcon; label: string; section: string; to: TickerPath };

export type InstrumentSectionGroup = { items: ReadonlyArray<InstrumentSection>; label: string };

/**
 * The sections of an instrument, grouped. Which ones show comes from the instrument's `datasets` through
 * `SECTION_DATASETS` (`servesSection`); a section the type lacks is hidden, never greyed.
 */
export const INSTRUMENT_SECTION_GROUPS: ReadonlyArray<InstrumentSectionGroup> = [
    { items: [{ icon: LayoutDashboardIcon, label: "Overview", section: "", to: "/$ticker" }], label: "Overview" },
    {
        items: [
            { icon: MicIcon, label: "Calls", section: "earnings-calls", to: "/$ticker/earnings-calls" },
            { icon: FolderOpenIcon, label: "Investor documents", section: "documents", to: "/$ticker/documents" },
        ],
        label: "Earnings",
    },
    { items: [{ icon: FileTextIcon, label: "Filings", section: "filings", to: "/$ticker/filings" }], label: "Filings" },
    { items: [{ icon: BarChart3Icon, label: "Financials", section: "financials", to: "/$ticker/financials" }], label: "Financials" },
    {
        items: [
            { icon: UsersIcon, label: "Holders", section: "holders", to: "/$ticker/holders" },
            { icon: PieChartIcon, label: "Holdings", section: "holdings", to: "/$ticker/holdings" },
            { icon: UserRoundIcon, label: "Insider trades", section: "insider-trades", to: "/$ticker/insider-trades" },
        ],
        label: "Ownership",
    },
    {
        items: [
            { icon: CoinsIcon, label: "Dividends", section: "dividends", to: "/$ticker/dividends" },
            { icon: SplitIcon, label: "Splits", section: "stock-splits", to: "/$ticker/stock-splits" },
        ],
        label: "Corporate actions",
    },
    { items: [{ icon: NewspaperIcon, label: "News", section: "news", to: "/$ticker/news" }], label: "News" },
];

/** The groups an instrument's `datasets` allow (every section while the datasets are unknown); empty groups dropped. */
export function instrumentSectionGroups(datasets: null | ReadonlyArray<V2Dataset>): Array<InstrumentSectionGroup> {
    return INSTRUMENT_SECTION_GROUPS
        .map(group => ({ ...group, items: group.items.filter(item => datasets === null || servesSection(datasets, item.section)) }))
        .filter(group => group.items.length > 0);
}

/** The flat sections an instrument's `datasets` allow. */
export function visibleInstrumentItems(datasets: null | ReadonlyArray<V2Dataset>): Array<InstrumentSection> {
    return instrumentSectionGroups(datasets).flatMap(group => group.items);
}

/** "AAPL · Stock", "SPY · ETF", "PDI · Closed-end fund", "GLD · ETF (trust)", "VXX · ETN". */
export function instrumentSubjectLabel(instrument: Pick<V2Instrument, "structure" | "symbol" | "type">) {
    const type = INSTRUMENT_TYPE_LABELS[instrument.type];

    return `${instrument.symbol} · ${instrument.structure === "exchange_traded_trust" ? `${type} (trust)` : type}`;
}

/** The forms that mark a 13F manager (a filer page shows its portfolio block). */
export const MANAGER_FORMS: ReadonlySet<string> = new Set(["13F-HR", "13F-HR/A", "13F-NT", "13F-NT/A"]);

/** Filings per page of a filer page's list (the sidebar asks the same first page: one cached request). */
export const FILER_FILINGS_PAGE = 40;

/** A 13F manager: phase `manager` or a 13F form in the filings facet. */
export function isManagerFiler(phase: null | string | undefined, facetForms: ReadonlyArray<string>) {
    return phase === "manager" || facetForms.some(form => MANAGER_FORMS.has(form));
}

/** "Vanguard Group · Institution" (a 13F manager), else "<name> · SEC filer". */
export function filerSubjectLabel(name: null | string | undefined, cik: string, isManager: boolean) {
    return `${name?.trim() || `CIK ${cik}`} · ${isManager ? "Institution" : "SEC filer"}`;
}

/** The ids of the blocks of `/sec/$cik` (in-page anchors of the sidebar's filer context). */
export const FILER_ANCHORS = {
    filings: "filings",
    fund: "fund-series",
    offerings: "private-offerings",
    portfolio: "portfolio",
    profile: "profile",
} as const;

export type FilerAnchor = { icon: LucideIcon; id: string; label: string };

/** The blocks a filer page has: Profile · 13F portfolio · Fund series · Filings · Private offerings (in page order). */
export function filerContextAnchors(filer: null | Pick<V2FilerResponse, "fund" | "private_offerings">, isManager: boolean): Array<FilerAnchor> {
    const anchors: Array<FilerAnchor> = [{ icon: IdCardIcon, id: FILER_ANCHORS.profile, label: "Profile" }];

    if (filer?.fund) anchors.push({ icon: LayersIcon, id: FILER_ANCHORS.fund, label: "Fund series" });

    if (filer?.private_offerings) anchors.push({ icon: HandCoinsIcon, id: FILER_ANCHORS.offerings, label: "Private offerings" });

    if (isManager) anchors.push({ icon: BriefcaseIcon, id: FILER_ANCHORS.portfolio, label: "13F portfolio" });

    anchors.push({ icon: FileTextIcon, id: FILER_ANCHORS.filings, label: "Filings" });

    return anchors;
}

/** The icon of the filer context's "Open <TICKER>" link. */
export const OPEN_LISTING_ICON = ArrowUpRightIcon;

/** A card of the landing page's "Browse" row: a Browse page opened with its filter. */
export type BrowseCard = { description: string; icon: LucideIcon; label: string } & (
    | { search: Record<string, never>; to: "/institutions" }
    | { search: { structure: "registered_fund" }; to: "/funds" }
    | { search: { type: "closed_end_fund" | "etf" | "etn" | "stock" }; to: "/instruments" }
);

/** The landing page's "Browse" row (the Browse pages of `BROWSE_NAV`, each with its first filter). */
export const BROWSE_CARDS: ReadonlyArray<BrowseCard> = [
    { description: "Companies listed on US exchanges.", icon: BuildingIcon, label: "Stocks", search: { type: "stock" }, to: "/instruments" },
    { description: "Exchange-traded funds and trusts.", icon: ChartPieIcon, label: "ETFs", search: { type: "etf" }, to: "/instruments" },
    { description: "Listed closed-end funds.", icon: LockKeyholeIcon, label: "Closed-end funds", search: { type: "closed_end_fund" }, to: "/instruments" },
    { description: "Exchange-traded notes.", icon: ReceiptIcon, label: "ETNs", search: { type: "etn" }, to: "/instruments" },
    { description: "Registered funds with their reported holdings.", icon: LayersIcon, label: "Funds with holdings", search: { structure: "registered_fund" }, to: "/funds" },
    { description: "13F managers and their portfolios.", icon: LandmarkIcon, label: "Institutions", search: {}, to: "/institutions" },
];

/** The blocks of `/people/$personId` (in-page anchors of the sidebar's person context), in page order. */
export const PERSON_CONTEXT_ANCHORS: ReadonlyArray<FilerAnchor> = [
    { icon: IdCardIcon, id: PERSON_ANCHORS.profile, label: "Profile" },
    { icon: MicIcon, id: PERSON_ANCHORS.calls, label: "Calls" },
    { icon: HistoryIcon, id: PERSON_ANCHORS.history, label: "Role & firm history" },
];
