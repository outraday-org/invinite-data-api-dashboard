import type { LucideIcon } from "lucide-react";

import {
    ActivityIcon,
    ArrowUpRightIcon,
    BarChart3Icon,
    BellIcon,
    BookOpenIcon,
    BriefcaseIcon,
    CalendarDaysIcon,
    CalendarOffIcon,
    CircleUserRoundIcon,
    CoinsIcon,
    ContactIcon,
    DatabaseIcon,
    FactoryIcon,
    FileTextIcon,
    FolderOpenIcon,
    HandCoinsIcon,
    HardHatIcon,
    HistoryIcon,
    HouseIcon,
    IdCardIcon,
    LandmarkIcon,
    LayersIcon,
    LayoutDashboardIcon,
    ListIcon,
    MicIcon,
    NewspaperIcon,
    PercentIcon,
    PieChartIcon,
    RadioIcon,
    RocketIcon,
    RssIcon,
    ScaleIcon,
    ScrollTextIcon,
    SearchIcon,
    SplineIcon,
    SplitIcon,
    TrendingUpIcon,
    UserRoundIcon,
    UsersIcon,
} from "lucide-react";

import type { OperationId } from "@/lib/api/operations.gen";
import type { V2Dataset, V2FilerResponse, V2Instrument } from "@/lib/api/types";
import type { FileRoutesByTo } from "@/routeTree.gen";

import { OPERATIONS } from "@/lib/api/operations.gen";
import { INSTRUMENT_TYPE_LABELS, servesSection } from "@/lib/instruments";
import { PERSON_ANCHORS } from "@/lib/people";
import { LICENSING_PAGE_URL, STATUS_PAGE_URL } from "@/lib/public-hosts";

/**
 * THE navigation table (backend tasks/data-api-dashboard O5): the sidebar and the search's
 * "Pages" group all read it, so a new top-level route is added here once, in the commit of its route
 * (`route-names.test.ts` fails for a top-level route without an entry).
 */

/** A path of the route tree without parameters (a top-level page). */
export type PagePath = Exclude<keyof FileRoutesByTo, `${string}$${string}`>;

export type NavPage = {
    /** One line for the search's "Pages" group. */
    description: string;
    icon: LucideIcon;
    /** Extra words the search's "Pages" group matches ("ipos" → IPO calendar). */
    keywords: ReadonlyArray<string>;
    label: string;
    to: PagePath;
};

export const MACRO_NAV = [
    { description: "US consumer price indexes and monthly and annual inflation.", icon: TrendingUpIcon, keywords: ["inflation", "CPI", "PCE", "prices"], label: "Inflation", to: "/us-macro/inflation" },
    { description: "US GDP growth, income and spending.", icon: FactoryIcon, keywords: ["GDP", "output", "income", "economic growth"], label: "GDP & income", to: "/us-macro/gdp" },
    { description: "Payrolls, employment, earnings, openings and weekly claims.", icon: HardHatIcon, keywords: ["labor", "payrolls", "jobs", "JOLTS", "unemployment", "claims"], label: "Labor market", to: "/us-macro/labor" },
    { description: "Daily nominal Treasury yields by maturity.", icon: SplineIcon, keywords: ["Treasury", "yield curve", "rates", "maturity"], label: "Treasury yield curve", to: "/us-macro/yield-curve" },
] as const satisfies ReadonlyArray<NavPage>;

// Every page once, as a constant: `MARKET_NAV`, `BROWSE_NAV` and `NAV_GROUPS` reference the same objects.
const HOME_NAV: NavPage = { description: "Live calls, today's earnings, next IPOs and holidays.", icon: HouseIcon, keywords: ["home", "start", "landing"], label: "Home", to: "/" };

const CALENDAR_NAV: NavPage = { description: "Earnings calls of every covered US company by day.", icon: CalendarDaysIcon, keywords: ["calendar", "earnings", "calls", "events"], label: "Earnings calendar", to: "/calendar" };

const LIVE_CALLS_NAV: NavPage = { description: "Every earnings call live right now.", icon: RadioIcon, keywords: ["live", "now", "calls", "audio"], label: "Live calls", to: "/live-calls" };

const IPOS_NAV: NavPage = { description: "Offerings from SEC registration to listing.", icon: RocketIcon, keywords: ["ipo", "ipos", "offerings", "listings", "spac"], label: "IPOs", to: "/ipo-calendar" };

const HOLIDAYS_NAV: NavPage = { description: "US exchange holidays and early closes.", icon: CalendarOffIcon, keywords: ["holidays", "closed", "market", "exchange"], label: "Market holidays", to: "/market-holidays" };

const INSTRUMENTS_NAV: NavPage = { description: "Every exchange-traded US symbol: stocks, ETFs, closed-end funds, ETNs.", icon: ListIcon, keywords: ["instruments", "stocks", "symbols", "tickers", "etn", "etns", "browse"], label: "Instruments", to: "/instruments" };

const FUNDS_NAV: NavPage = { description: "Every listed ETF and closed-end fund with net assets.", icon: LayersIcon, keywords: ["funds", "etf", "etfs", "closed-end", "holdings"], label: "Funds", to: "/funds" };

const INSTITUTIONS_NAV: NavPage = { description: "13F investment managers and their portfolios.", icon: LandmarkIcon, keywords: ["institutions", "managers", "13f", "holders", "filers"], label: "Institutions", to: "/institutions" };

const OWNERSHIP_FILINGS_NAV: NavPage = { description: "Schedule 13D / 13G filings of holders above 5 %, and Form 144 notices of proposed insider sales.", icon: PercentIcon, keywords: ["ownership", "13d", "13g", "activist", "passive", "beneficial", "form 144", "proposed sale", "insider"], label: "Ownership filings", to: "/ownership-filings" };

const PEOPLE_NAV: NavPage = { description: "Executives and analysts who speak on calls, with every call of each.", icon: ContactIcon, keywords: ["people", "persons", "executives", "analysts", "speakers", "participants"], label: "People", to: "/people" };

const NEWS_FEED_NAV: NavPage = { description: "Your watchlist's news in one list, and every company's new items live.", icon: RssIcon, keywords: ["news", "feed", "watchlist", "live", "press releases"], label: "News feed", to: "/news-feed" };

const FILINGS_NAV: NavPage = { description: "New SEC filings as they arrive, and full-text search across every filer.", icon: ScrollTextIcon, keywords: ["filings", "sec", "edgar", "8-k", "10-k", "live", "search"], label: "Filings", to: "/filings" };

const DATASETS_NAV: NavPage = { description: "SEC bulk files to download, company exports and the data set releases (Enterprise).", icon: DatabaseIcon, keywords: ["sec", "datasets", "data sets", "bulk", "releases", "13f", "n-port", "download", "parquet", "export"], label: "SEC bulk data", to: "/sec/datasets" };

const TRANSCRIPT_SEARCH_NAV: NavPage = { description: "What was said on every company's earnings calls: passages from transcripts, Q&A and slides.", icon: SearchIcon, keywords: ["search", "transcripts", "transcript", "passages", "quotes", "calls", "full-text"], label: "Transcript search", to: "/search" };

const CATALOG_NAV: NavPage = { description: "Metrics, mapping rules, SEC forms and sections, event types, document kinds.", icon: BookOpenIcon, keywords: ["catalog", "reference", "metrics", "definitions", "mapping", "forms", "sections", "glossary"], label: "Catalog", to: "/catalog" };

const OFFERINGS_NAV: NavPage = { description: "Form D private offerings of every issuer, with amounts, exemptions and related persons.", icon: HandCoinsIcon, keywords: ["offerings", "form d", "private", "placements", "exemptions", "raises"], label: "Private offerings", to: "/offerings" };

const ALERTS_NAV: NavPage = { description: "Your alert rules, what fired, live, and every alert's actions.", icon: BellIcon, keywords: ["alerts", "alert", "notifications", "webhooks", "events", "triggers", "watch"], label: "Alerts", to: "/alerts" };

/** Market pages (the search and the route test read the flat lists; the sidebar reads `NAV_GROUPS`). */
export const MARKET_NAV: ReadonlyArray<NavPage> = [HOME_NAV, CALENDAR_NAV, LIVE_CALLS_NAV, IPOS_NAV, HOLIDAYS_NAV, ...MACRO_NAV];

/** Browse pages. */
export const BROWSE_NAV: ReadonlyArray<NavPage> = [
    INSTRUMENTS_NAV,
    FUNDS_NAV,
    INSTITUTIONS_NAV,
    OWNERSHIP_FILINGS_NAV,
    PEOPLE_NAV,
    NEWS_FEED_NAV,
    FILINGS_NAV,
    DATASETS_NAV,
    TRANSCRIPT_SEARCH_NAV,
    CATALOG_NAV,
    OFFERINGS_NAV,
    ALERTS_NAV,
];

/** A collapsible group of the sidebar (ui-redesign task 4); its open state is stored per browser. */
export type NavGroup = { defaultOpen: boolean; id: string; label: string; pages: ReadonlyArray<NavPage> };

/** The sidebar's groups: every page of `MARKET_NAV` and `BROWSE_NAV` in exactly one (`navigation.test.ts`). */
export const NAV_GROUPS: ReadonlyArray<NavGroup> = [
    { defaultOpen: true, id: "market", label: "Market", pages: [HOME_NAV, CALENDAR_NAV, LIVE_CALLS_NAV, IPOS_NAV, HOLIDAYS_NAV] },
    { defaultOpen: true, id: "securities", label: "Securities", pages: [INSTRUMENTS_NAV, FUNDS_NAV, INSTITUTIONS_NAV, OWNERSHIP_FILINGS_NAV, PEOPLE_NAV] },
    { defaultOpen: false, id: "filings", label: "Filings", pages: [FILINGS_NAV, OFFERINGS_NAV, DATASETS_NAV] },
    { defaultOpen: false, id: "research", label: "News & search", pages: [NEWS_FEED_NAV, TRANSCRIPT_SEARCH_NAV] },
    { defaultOpen: false, id: "macro", label: "US macro", pages: MACRO_NAV },
    { defaultOpen: false, id: "build", label: "Build", pages: [ALERTS_NAV, CATALOG_NAV] },
];

/** The group holding the page of a path (the page itself or one below it: `/alerts/new` → Build); `/` only exactly. */
export function navGroupOfPath(pathname: string): NavGroup | null {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

    return NAV_GROUPS.find(group => group.pages.some(page => page.to === "/" ? path === "/" : path === page.to || path.startsWith(`${page.to}/`))) ?? null;
}

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

/** `shortLabel`: the ticker header's tab text where the sidebar's label is long ("Investor documents" → "Documents"). */
export type InstrumentSection = { icon: LucideIcon; label: string; section: string; shortLabel?: string; to: TickerPath };

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
            { icon: FolderOpenIcon, label: "Investor documents", section: "documents", shortLabel: "Documents", to: "/$ticker/documents" },
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

/** The manager signal of a filer answer: `files_13f` (Data API, backend ui-walk task 1 D1) and the lifecycle `phase`. */
export type ManagerSignal = { files_13f?: boolean | null; phase?: null | string };

/**
 * The filer files 13F-HR: `files_13f`, else (an answer without the field) `phase === "manager"`. A listed company that
 * files 13F (Berkshire Hathaway) keeps `phase: "public"` and is still a manager.
 */
export function filesThirteenF(filer: ManagerSignal | null | undefined) {
    return filer?.files_13f === true || filer?.phase === "manager";
}

/** A 13F manager: `files_13f` (or phase `manager`) or a 13F form in the filings facet. */
export function isManagerFiler(filer: ManagerSignal | null | undefined, facetForms: ReadonlyArray<string>) {
    return filesThirteenF(filer) || facetForms.some(form => MANAGER_FORMS.has(form));
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

/** The blocks of `/people/$personId` (in-page anchors of the sidebar's person context), in page order. */
export const PERSON_CONTEXT_ANCHORS: ReadonlyArray<FilerAnchor> = [
    { icon: IdCardIcon, id: PERSON_ANCHORS.profile, label: "Profile" },
    { icon: MicIcon, id: PERSON_ANCHORS.calls, label: "Calls" },
    { icon: HistoryIcon, id: PERSON_ANCHORS.history, label: "Role & firm history" },
];

// The API's data families: the landing page's "What the API covers" list.

/** The page a family row opens (a ticker page names its example symbol in `params`). */
export type ApiFamilyLink
    = | { params: { ticker: string }; to: "/$ticker/financials" }
        | { params?: undefined; to: PagePath };

/**
 * A data family of the Data API: its operations are the HTTP operations of `operations.gen.ts` whose path template
 * starts with one of `prefixes` (`/v1/events` holds `/v1/events/{event_id}/qa`; `/v1/alerts` holds `/v1/alerts:batch`).
 */
export type ApiFamily = { description: string; id: string; label: string; link: ApiFamilyLink; prefixes: ReadonlyArray<string> };

/**
 * The landing page's coverage list (ui-redesign task 7): every HTTP operation belongs to exactly one family — the one
 * with the LONGEST matching prefix (`/v1/filers/{cik}/holdings` is Ownership, `/v1/filers` Filings);
 * `api-families.test.ts` fails on an operation without a family, a prefix listed twice or a prefix matching nothing.
 * The WebSocket `streamEvents` is not an HTTP operation and is not counted ("+ live stream" in the descriptions).
 */
export const API_FAMILIES: ReadonlyArray<ApiFamily> = [
    {
        description: "Transcripts, audio, slides, Q&A, guidance, KPIs and KPI series, non-GAAP figures, speakers and investor documents, + live stream.",
        id: "earnings",
        label: "Earnings calls",
        link: { to: "/live-calls" },
        prefixes: ["/v1/events", "/v1/guidance", "/v1/kpis", "/v1/kpi-series", "/v1/non-gaap", "/v1/participants", "/v1/people", "/v1/search/transcripts", "/v1/investor-documents", "/v1/search/investor-documents"],
    },
    {
        description: "Every SEC filing and filer, document text, full-text search, Form D offerings, SEC bulk files, + live stream.",
        id: "filings",
        label: "Filings",
        link: { to: "/filings" },
        prefixes: ["/v1/filings", "/v1/filers", "/v1/document-versions", "/v1/search/filings", "/v1/datasets", "/v1/bulk", "/v1/offerings"],
    },
    {
        description: "Standardized and as-reported statements, ratios, growth, segments, facts with their source (e.g. AAPL).",
        id: "financials",
        label: "Financials",
        link: { params: { ticker: "AAPL" }, to: "/$ticker/financials" },
        prefixes: ["/v1/financials", "/v1/metrics", "/v1/segments", "/v1/facts", "/v1/fact-places", "/v1/fiscal-periods"],
    },
    {
        description: "13F and N-PORT holders, quarter-on-quarter changes, manager portfolios, insider trades and holdings, 13D / 13G and Form 144.",
        id: "ownership",
        label: "Ownership",
        link: { to: "/institutions" },
        prefixes: ["/v1/holders", "/v1/holder-changes", "/v1/insider-trades", "/v1/insider-holdings", "/v1/filers/{cik}/holdings", "/v1/filers/{cik}/holding-changes", "/v1/beneficial-ownership", "/v1/insider-sale-notices"],
    },
    {
        description: "ETFs and closed-end funds with net assets, positions and weights.",
        id: "funds",
        label: "Funds",
        link: { to: "/funds" },
        prefixes: ["/v1/funds"],
    },
    {
        description: "Company news with Invinite's summaries, announcements and news search, + live stream.",
        id: "news",
        label: "News",
        link: { to: "/news-feed" },
        prefixes: ["/v1/news", "/v1/announcements", "/v1/search/news"],
    },
    {
        description: "Dividends, stock splits and IPOs from registration to listing.",
        id: "corporate-actions",
        label: "Corporate actions",
        link: { to: "/ipo-calendar" },
        prefixes: ["/v1/dividends", "/v1/splits", "/v1/ipos"],
    },
    {
        description: "US inflation, GDP, labor market and the Treasury yield curve.",
        id: "macro",
        label: "US macro",
        link: { to: "/us-macro/inflation" },
        prefixes: ["/v1/macro"],
    },
    {
        description: "Alert rules, events, end users, webhook destinations and scripts, + live stream.",
        id: "alerts",
        label: "Alerts",
        link: { to: "/alerts" },
        prefixes: ["/v1/alerts", "/v1/alert-events", "/v1/alert-templates", "/v1/alert-users", "/v1/destinations", "/v1/scripts", "/v1/me/alert-user-defaults"],
    },
    {
        description: "Instruments, companies, catalog definitions, market holidays, your account and the API status.",
        id: "reference",
        label: "Reference",
        link: { to: "/catalog" },
        prefixes: ["/v1/instruments", "/v1/companies", "/v1/catalog", "/v1/market-holidays", "/v1/me", "/status", "/health"],
    },
];

/** Whether a path template lies under a prefix (the prefix itself, a sub-path or a colon verb). */
function underPrefix(path: string, prefix: string) {
    return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}:`);
}

/** The family of an operation's path template: the one with the longest matching prefix, else null. */
export function apiFamilyOf(path: string): ApiFamily | null {
    let best: null | { family: ApiFamily; length: number } = null;

    for (const family of API_FAMILIES) {
        for (const prefix of family.prefixes) {
            if (underPrefix(path, prefix) && prefix.length > (best?.length ?? -1)) best = { family, length: prefix.length };
        }
    }

    return best?.family ?? null;
}

/** Each family's operation ids, computed from the operations table (never typed by hand). */
export const API_FAMILY_OPERATIONS: Readonly<Record<string, ReadonlyArray<OperationId>>> = Object.fromEntries(
    API_FAMILIES.map(family => [
        family.id,
        (Object.keys(OPERATIONS) as Array<OperationId>).filter(id => apiFamilyOf(OPERATIONS[id].path)?.id === family.id),
    ]),
);
