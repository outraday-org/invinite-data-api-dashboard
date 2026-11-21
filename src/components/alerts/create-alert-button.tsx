import { Link } from "@tanstack/react-router";
import { BellPlusIcon, ChevronDownIcon } from "lucide-react";

import type { AlertsListResponse, AlertType, V2Instrument } from "@/lib/api/types";

import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ALERT_TYPE_INFO, PRICE_ALERT_TYPES } from "@/lib/alerts/labels";
import { useInstrument, useKeyState, useSymbolAlertCount } from "@/lib/api/queries";
import { formatNumber } from "@/lib/format";
import { plansAlerts } from "@/routes/alerts/route";

/**
 * The "Create alert" entry points of ticker pages (backend tasks/data-api-dashboard 2-alerts task 4): a button in the
 * page header opening `/alerts/new?type=…&symbol=…` (a menu when the page fits several types) and a small
 * "N alerts on AAPL" link to `/alerts?symbol=AAPL` (the API's own filter). N = the length of ONE `listAlerts?symbol=`
 * page, "N+" when it has more; asked once per ticker and cached. Nothing renders for a plan without alerts, nor on a
 * page whose types the instrument cannot carry (an ETF's news).
 */

/** The alert types each ticker page offers, before `entryTypesFor` drops the ones the instrument cannot carry. */
export const ENTRY_TYPES = {
    calls: ["earnings_call", "earnings_call_keyword", "earnings_results", "event_countdown"],
    dividends: ["dividend"],
    filings: ["filing", "filing_keyword"],
    news: ["news", "news_keyword"],
    overview: [...PRICE_ALERT_TYPES, "fundamental_metric"],
} as const satisfies Record<string, ReadonlyArray<AlertType>>;

/**
 * The types an instrument that is not a stock can carry (`AlertConditionInput`: a US ETF takes `dividend`,
 * `event_countdown`, `filing`, `filing_keyword` and the instrument types; `earnings_call*`, `earnings_results`,
 * `fundamental_metric`, `news*` refuse it). Applied to every non-stock type (fund, ETN): only what surely works.
 */
export const NON_STOCK_ALERT_TYPES: ReadonlyArray<AlertType> = [...PRICE_ALERT_TYPES, "indicator", "script", "dividend", "event_countdown", "filing", "filing_keyword"];

/**
 * The page's types the instrument can carry (pure): none when its `datasets` (the API's own table) lacks `alerts` or
 * it is not loaded; a stock all of them; any other type only `NON_STOCK_ALERT_TYPES`. Empty = no entry point at all.
 */
export function entryTypesFor(types: ReadonlyArray<AlertType>, instrument: null | Pick<V2Instrument, "datasets" | "type"> | undefined): Array<AlertType> {
    if (!instrument?.datasets.includes("alerts")) return [];

    return instrument.type === "stock" ? [...types] : types.filter(type => NON_STOCK_ALERT_TYPES.includes(type));
}

/** "3 alerts on AAPL", "100+ alerts on AAPL" (one page with `has_more`), "No alert on AAPL" (pure). */
export function symbolAlertsText(page: Pick<AlertsListResponse, "data" | "has_more">, symbol: string) {
    const count = page.data.length;

    if (count === 0) return `No alert on ${symbol}`;

    return `${formatNumber(count)}${page.has_more ? "+" : ""} alert${count === 1 && !page.has_more ? "" : "s"} on ${symbol}`;
}

/** The link to the ticker's alerts (pure). */
export function SymbolAlertsLink({ page, symbol }: { page: Pick<AlertsListResponse, "data" | "has_more">; symbol: string }) {
    return (
        <Link className="text-primary underline-offset-4 hover:underline" data-testid="symbol-alerts-link" search={{ symbol }} to="/alerts">
            {symbolAlertsText(page, symbol)}
        </Link>
    );
}

/** "Create alert" (pure): one type = a link button; several = a menu of the types, each a link. */
export function CreateAlertButton({ symbol, types }: { symbol: string; types: ReadonlyArray<AlertType> }) {
    if (types.length === 1) {
        return (
            <Link className={buttonVariants({ size: "sm", variant: "outline" })} search={{ symbol, type: types[0] }} to="/alerts/new">
                <BellPlusIcon />
                {`Create ${ALERT_TYPE_INFO[types[0]].label.toLowerCase()} alert`}
            </Link>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ size: "sm", variant: "outline" })}>
                <BellPlusIcon />
                Create alert
                <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                    {types.map(type => (
                        <DropdownMenuItem key={type} render={<Link search={{ symbol, type }} to="/alerts/new" />}>
                            <span className="flex flex-col">
                                <span className="font-medium">{ALERT_TYPE_INFO[type].label}</span>
                                <span className="text-muted-foreground">{ALERT_TYPE_INFO[type].summary}</span>
                            </span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * The entry points of one ticker page: the alerts link (once its one page answered) and "Create alert" with the page's
 * types the instrument can carry (the layout already read the instrument: same query). Nothing without the alerts
 * plan, or when the instrument can carry none of the page's types.
 */
export function AlertEntryPoints({ symbol, types }: { symbol: string; types: ReadonlyArray<AlertType> }) {
    const { me } = useKeyState();

    const instrument = useInstrument(symbol);

    const offered = entryTypesFor(types, instrument.data);

    const allowed = me !== null && plansAlerts(me) && offered.length > 0;

    const count = useSymbolAlertCount(symbol, allowed);

    if (!allowed) return null;

    return (
        <div className="flex flex-wrap items-center gap-2" data-testid="alert-entry-points">
            {count.data && <SymbolAlertsLink page={count.data} symbol={symbol} />}
            <CreateAlertButton symbol={symbol} types={offered} />
        </div>
    );
}
