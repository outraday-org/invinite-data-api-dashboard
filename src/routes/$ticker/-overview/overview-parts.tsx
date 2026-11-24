import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import type { FinancialView } from "@/components/financials-pages/views";
import type { V2CompanyCoverage } from "@/lib/api/types";
import type { TickerPath } from "@/lib/navigation";

import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { coverageFamilyLabel } from "@/lib/api/v2";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Pieces shared by the stock, fund and ETN overviews (ui-redesign task 8): the two-column layout, the loading skeleton
 * and "Data available".
 */

/** A public http(s) link of the company or fund (its website, its IR site), else null: never a script URL. */
export const httpsHref = (url: null | string | undefined) => (url && /^https?:\/\//i.test(url) ? url : null);

/** An external link with the ↗ mark (a new tab, no referrer): a company's or fund's website, its IR site. */
export function ExternalLink({ children, href }: { children: ReactNode; href: string }) {
    return (
        <a className="inline-flex items-center gap-0.5 underline-offset-4 hover:underline" href={href} rel="noopener noreferrer" target="_blank">
            {children}
            <ArrowUpRight aria-hidden className="size-3.5" />
        </a>
    );
}

/** A day in words, or null (left out of a grid / fact list). */
export const dayOrNull = (value: null | string | undefined) => (value ? formatDay(value) : null);

/**
 * The overview's layout: `lead` (key facts) and `rest` (the other sections) in the main column, `side` (next up,
 * identifiers / profile) in a 20 rem column beside them — decided by the CONTENT width (a container query, `@5xl` =
 * 64 rem), not the viewport, so a docked request panel or an open sidebar falls back to one column by itself. One column
 * reads lead → side → rest.
 */
export function OverviewColumns({ lead, rest, side }: { lead: ReactNode; rest: ReactNode; side: ReactNode }) {
    return (
        <div className="@container" data-testid="overview-columns">
            <div className="grid gap-8 @5xl:grid-cols-[minmax(0,1fr)_20rem] @5xl:grid-rows-[auto_1fr]">
                <div className="flex min-w-0 flex-col gap-8">{lead}</div>
                <div className="flex min-w-0 flex-col gap-8 @5xl:col-start-2 @5xl:row-span-2 @5xl:row-start-1">{side}</div>
                <div className="flex min-w-0 flex-col gap-8 @5xl:col-start-1 @5xl:row-start-2">{rest}</div>
            </div>
        </div>
    );
}

/** The overview while it loads: two description lines and a stat grid's cells. */
export function OverviewSkeleton() {
    return (
        <div aria-busy className="flex flex-col gap-6" data-testid="overview-skeleton">
            <div className="flex max-w-[68ch] flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }, (_, index) => (
                    <div className="flex flex-col gap-1.5 py-1" key={index}>
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-5 w-28" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/** The overview section a coverage family's data lives on (a family without a page = plain text). */
const COVERAGE_SECTIONS: Partial<Record<string, { to: "/$ticker/financials"; view: FinancialView } | { to: TickerPath }>> = {
    dividends: { to: "/$ticker/dividends" },
    events: { to: "/$ticker/earnings-calls" },
    filings: { to: "/$ticker/filings" },
    financials: { to: "/$ticker/financials" },
    // A fund's own composition (ui-redesign task 8: was plain text).
    fund_holdings: { to: "/$ticker/holdings" },
    holdings: { to: "/$ticker/holders" },
    insider_trades: { to: "/$ticker/insider-trades" },
    metrics: { to: "/$ticker/financials", view: "ratios" },
    news: { to: "/$ticker/news" },
    segments: { to: "/$ticker/financials", view: "segments" },
    splits: { to: "/$ticker/stock-splits" },
};

/**
 * `expand=coverage`: which data families hold rows for the company (or fund) and through which day, as a compact list
 * (two columns from 640 px) — "dividends … through Nov 1, 2026"; each row links its section.
 */
export function CoverageSection({ coverage, noun = "company", ticker }: { coverage: null | undefined | V2CompanyCoverage; noun?: "company" | "fund"; ticker: string }) {
    const families = coverage?.families ?? [];

    return (
        <Section description={`The data families that hold rows for this ${noun}`} title="Data available">
            {families.length === 0
                ? <div className="text-muted-foreground">{`No data family holds rows for this ${noun} yet.`}</div>
                : (
                        <ul className="grid gap-x-8 sm:grid-cols-2" data-testid="coverage-list">
                            {families.map(({ family, through }) => {
                                const target = COVERAGE_SECTIONS[family];

                                const row = (
                                    <>
                                        <span className="first-letter:uppercase">{coverageFamilyLabel(family)}</span>
                                        {through && <span className="text-muted-foreground text-xs tabular-nums">{` through ${formatDay(through)}`}</span>}
                                    </>
                                );

                                const rowClass = "flex min-h-9 items-baseline justify-between gap-3 py-2";

                                const linkClass = cn(rowClass, "hover:text-primary");

                                return (
                                    <li className="border-b" key={family}>
                                        {!target
                                            ? <div className={rowClass}>{row}</div>
                                            : "view" in target
                                                ? <Link className={linkClass} params={{ ticker }} search={{ view: target.view }} to={target.to}>{row}</Link>
                                                : <Link className={linkClass} params={{ ticker }} to={target.to}>{row}</Link>}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
        </Section>
    );
}
