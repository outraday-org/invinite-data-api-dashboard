import { createFileRoute, Link } from "@tanstack/react-router";

import { ApiKeyInlineField } from "@/components/api-key/api-key-inline";
import { SecFilerLookup } from "@/components/sec/sec-filer-lookup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { dataApiDashboardUrl } from "@/lib/app-url";
import { titleHead } from "@/lib/layout";
import { LICENSING_PAGE_URL, STATUS_PAGE_URL } from "@/lib/public-hosts";
import { useTickerStore } from "@/lib/stores/ticker-store";

export const Route = createFileRoute("/")({
    component: IndexPage,
    head: () => titleHead(),
});

function IndexPage() {
    const { hasHydrated, lastTicker } = useTickerStore();

    const sampleTicker = (hasHydrated ? lastTicker : null) ?? "AAPL";

    const routeCards = [
        {
            body: "A stock's company profile or a fund's profile (net assets, expense ratio, classes, composition).",
            title: "Overview",
            to: "/$ticker",
        },
        {
            body: "Standardized, as-reported, growth, CAGR, ratios, and segmented views.",
            title: "Financials",
            to: "/$ticker/financials-standardized",
        },
        {
            body: "Filter SEC filings and open HTML/PDF documents.",
            title: "SEC Filings",
            to: "/$ticker/filings",
        },
        {
            body: "Transcripts, audio, slides, guidance and KPIs per call; live calls with audio and a live transcript.",
            title: "Earnings Calls",
            to: "/$ticker/earnings-calls",
        },
        {
            body: "Historical dividend announcements and payouts.",
            title: "Dividends",
            to: "/$ticker/dividends",
        },
        {
            body: "Split history of a stock or a fund.",
            title: "Splits",
            to: "/$ticker/stock-splits",
        },
        {
            body: "Insider transactions and ownership activity.",
            title: "Insider Trades",
            to: "/$ticker/insider-trades",
        },
        {
            body: "Who holds it: 13F managers, N-PORT funds and ETF issuer files, each source on its own.",
            title: "Holders",
            to: "/$ticker/holders",
        },
        {
            body: "Upcoming and past calls across the market, live now.",
            title: "Earnings Calendar",
            to: "/$ticker/earnings-calendar",
        },
        {
            body: "Upcoming IPO calendar and listings.",
            title: "IPOs",
            to: "/$ticker/ipos",
        },
        {
            body: "Exchange holiday schedule and closures.",
            title: "Market Holidays",
            to: "/$ticker/market-holidays",
        },
    ] as const;

    // Public, key-less pages on other hosts: the status page (`../invinite-data-api/status/`) and the
    // licensing matrix (Invinite Data docs); `/status` and `/licensing` here redirect there.
    const publicCards = [
        {
            body: "Measured availability, latency and reachability of the API — on its own host.",
            href: STATUS_PAGE_URL,
            title: "API Status",
        },
        {
            body: "What each plan may do with the data, per route; never resale as your own.",
            href: LICENSING_PAGE_URL,
            title: "Licensing",
        },
    ] as const;

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 lg:px-8">
            <section className="space-y-4">
                <p className="text-xs uppercase tracking-[0.2em] text-primary">Invinite API</p>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    Financial Data Dashboard
                </h1>
                <p className="text-muted-foreground max-w-3xl text-lg">
                    Explore what the Invinite Data API serves. Enter a ticker — a stock, an ETF, a closed-end fund or an
                    ETN — to view what the API serves for it: company or fund profile, financial statements, holdings,
                    holders and SEC filings. The Funds page lists every listed fund.
                </p>
                <p className="text-muted-foreground text-sm">
                    {`Use the search bar to jump to any ticker. Cards below use ${sampleTicker} as a quick preview.`}
                </p>
            </section>

            <Card className="border-border/60">
                <CardContent>
                    <ApiKeyInlineField />
                </CardContent>
            </Card>

            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle>SEC filers</CardTitle>
                    <CardDescription>
                        Any SEC filer by CIK or name — including pre-IPO issuers, SPACs and 13F managers without a ticker.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SecFilerLookup />
                </CardContent>
            </Card>

            <Separator />

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {routeCards.map(item => (
                    <Link
                        className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                        key={item.title}
                        params={{ ticker: sampleTicker }}
                        to={item.to}
                    >
                        <RouteCard body={item.body} title={item.title} />
                    </Link>
                ))}
                {publicCards.map(item => (
                    <a
                        className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                        href={item.href}
                        key={item.title}
                        rel="noreferrer"
                    >
                        <RouteCard body={item.body} title={item.title} />
                    </a>
                ))}
                {/* The account itself (keys, usage, credits, invoices) lives in the Invinite app, not here. */}
                <a
                    className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                    href={dataApiDashboardUrl()}
                    rel="noreferrer"
                    target="_blank"
                >
                    <RouteCard
                        body="Your keys, requests and credits per day, endpoint and key, plan, prepaid credits and invoices."
                        title="Usage and billing"
                    />
                </a>
            </section>
        </div>
    );
}

function RouteCard({ body, title }: { body: string; title: string }) {
    return (
        <Card className="border-border/60 h-full transition hover:border-primary/60">
            <CardHeader className="gap-2">
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{body}</CardDescription>
            </CardHeader>
        </Card>
    );
}
