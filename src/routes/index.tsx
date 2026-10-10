import { createFileRoute, Link } from "@tanstack/react-router";

import { ApiKeyInlineField } from "@/components/api-key/api-key-inline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useTickerStore } from "@/lib/stores/ticker-store";

export const Route = createFileRoute("/")({
    component: IndexPage,
});

function IndexPage() {
    const { hasHydrated, lastTicker } = useTickerStore();

    const sampleTicker = (hasHydrated ? lastTicker : null) ?? "AAPL";

    const routeCards = [
        {
            body: "Company profile, market stats, and key details.",
            title: "Company Overview",
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
            body: "Corporate stock split history.",
            title: "Stock Splits",
            to: "/$ticker/stock-splits",
        },
        {
            body: "Insider transactions and ownership activity.",
            title: "Insider Trades",
            to: "/$ticker/insider-trades",
        },
        {
            body: "Institutional ownership snapshots.",
            title: "Institutions",
            to: "/$ticker/institutions",
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

    // Public, key-less pages: no ticker param.
    const publicCards = [
        {
            body: "Measured availability and latency per product family, data freshness, earnings-call pipeline latency and coverage.",
            title: "API Status",
            to: "/status",
        },
        {
            body: "What each plan may do with the data, per route; never resale as your own.",
            title: "Licensing",
            to: "/licensing",
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
                    Demo project for using the Invinite API. Enter a ticker to view company info,
                    standardized financial statements, and SEC filings.
                </p>
                <p className="text-muted-foreground text-sm">
                    Use the search bar to jump to any ticker. Cards below use
                    {sampleTicker}
                    as a quick preview.
                </p>
            </section>

            <Card className="border-border/60">
                <CardContent>
                    <ApiKeyInlineField />
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
                    <Link
                        className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                        key={item.title}
                        to={item.to}
                    >
                        <RouteCard body={item.body} title={item.title} />
                    </Link>
                ))}
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
