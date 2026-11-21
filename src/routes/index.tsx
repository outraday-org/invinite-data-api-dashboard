import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";

import type { V2Event, V2Ipo, V2MarketHoliday } from "@/lib/api/types";
import type { RecentSubject } from "@/lib/stores/ticker-store";

import { SecFilerLookup } from "@/components/sec/sec-filer-lookup";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2EventsInfinite, useV2IposInfinite, useV2LiveEvents, useV2MarketHolidaysInfinite } from "@/lib/api/queries";
import { calendarPresetWindow } from "@/lib/earnings/calendar-groups";
import { callCalendarDate, eventLabel, formatCallTime, formatStartedAgo, zonedDate } from "@/lib/earnings/format";
import { formatDay } from "@/lib/format";
import { titleHead } from "@/lib/layout";
import { BROWSE_CARDS } from "@/lib/navigation";
import { selectRecents, useTickerStore } from "@/lib/stores/ticker-store";
import { EventLink } from "@/routes/$ticker/earnings-calls/-components/event-link";
import { LiveDot } from "@/routes/$ticker/earnings-calls/-components/live-dot";
import { holidayStatus } from "@/routes/market-holidays";

import { ipoListedTicker, ipoSymbolText, offerPriceText } from "./ipo-calendar";

export const Route = createFileRoute("/")({
    component: IndexPage,
    head: () => titleHead(),
});

const NEW_YORK = "America/New_York";

/** Rows per landing block: the first N in the API's order (an event carries no market cap or rank to order by). */
export const LANDING_ROWS = 8;

export type LandingData = {
    holiday: { data: null | V2MarketHoliday; isLoading: boolean };
    ipos: { data: ReadonlyArray<V2Ipo>; isLoading: boolean };
    live: { asOf: Date; data: ReadonlyArray<V2Event>; isLoading: boolean };
    recents: ReadonlyArray<RecentSubject>;
    today: string;
    week: { data: ReadonlyArray<V2Event>; isLoading: boolean };
};

function Block({ action, children, title }: { action?: React.ReactNode; children: React.ReactNode; title: string }) {
    return (
        <Card className="border-border/60" size="sm">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>{title}</CardTitle>
                {action}
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

function MoreLink({ children, to }: { children: React.ReactNode; to: "/calendar" | "/ipo-calendar" | "/live-calls" | "/market-holidays" }) {
    return <Link className="text-primary text-xs underline-offset-4 hover:underline" to={to}>{children}</Link>;
}

function EventRows({ empty, events }: { empty: string; events: ReadonlyArray<V2Event> }) {
    if (events.length === 0) return <p className="text-muted-foreground">{empty}</p>;

    return (
        <ul className="flex flex-col divide-y">
            {events.map(event => (
                <li className="flex items-baseline gap-3 py-1.5" key={event.event_id}>
                    <EventLink className="w-14 shrink-0 font-medium hover:underline" event={event}>{event.symbol}</EventLink>
                    <span className="min-w-0 grow truncate">{event.company_name}</span>
                    <span className="text-muted-foreground shrink-0">{eventLabel(event)}</span>
                    <span className="text-muted-foreground hidden w-40 shrink-0 text-right tabular-nums sm:block">{formatCallTime(event)}</span>
                </li>
            ))}
        </ul>
    );
}

/**
 * The landing page with data (pure): live calls, today's and this week's earnings (the first N), the next IPOs, the next
 * market holiday, the Browse cards of the navigation table and the recently opened subjects.
 */
export function LandingView({ holiday, ipos, live, recents, today, week }: LandingData) {
    const todays = week.data.filter(event => callCalendarDate(event, NEW_YORK) === today);

    const later = week.data.filter(event => callCalendarDate(event, NEW_YORK) > today);

    return (
        <div className="flex flex-col gap-6">
            <Block action={<MoreLink to="/live-calls">All live calls</MoreLink>} title="Live now">
                {live.isLoading
                    ? <Skeleton className="h-10 w-full" />
                    : live.data.length === 0
                        ? <p className="text-muted-foreground">No call is live right now.</p>
                        : (
                                <div className="flex flex-wrap gap-2" data-testid="landing-live">
                                    {live.data.slice(0, LANDING_ROWS).map(event => (
                                        <EventLink className="hover:bg-muted/50 flex items-center gap-2 rounded-md border px-2 py-1" event={event} key={event.event_id}>
                                            <LiveDot />
                                            <span className="font-medium">{event.symbol}</span>
                                            <span className="text-muted-foreground">{event.started_at ? formatStartedAgo(event.started_at, live.asOf) : "starting"}</span>
                                        </EventLink>
                                    ))}
                                    {live.data.length > LANDING_ROWS && <MoreLink to="/live-calls">{`+${live.data.length - LANDING_ROWS} more`}</MoreLink>}
                                </div>
                            )}
            </Block>

            <div className="grid gap-6 lg:grid-cols-2">
                <Block action={<MoreLink to="/calendar">Earnings calendar</MoreLink>} title="Earnings today">
                    {week.isLoading ? <Skeleton className="h-32 w-full" /> : <EventRows empty="No earnings call today." events={todays.slice(0, LANDING_ROWS)} />}
                </Block>
                <Block action={<MoreLink to="/calendar">This week</MoreLink>} title="Later this week">
                    {week.isLoading ? <Skeleton className="h-32 w-full" /> : <EventRows empty="No more calls this week." events={later.slice(0, LANDING_ROWS)} />}
                </Block>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Block action={<MoreLink to="/ipo-calendar">IPO calendar</MoreLink>} title="Next IPOs">
                    {ipos.isLoading
                        ? <Skeleton className="h-24 w-full" />
                        : ipos.data.length === 0
                            ? <p className="text-muted-foreground">No IPO with a listing date ahead.</p>
                            : (
                                    <ul className="flex flex-col divide-y" data-testid="landing-ipos">
                                        {ipos.data.map((ipo) => {
                                            const listed = ipoListedTicker(ipo);

                                            return (
                                                <li className="flex items-baseline gap-3 py-1.5" key={ipo.ipo_id}>
                                                    <span className="w-24 shrink-0 tabular-nums">{formatDay(ipo.listing_date)}</span>
                                                    {listed
                                                        ? <Link className="shrink-0 font-medium hover:underline" params={{ ticker: listed }} to="/$ticker">{listed}</Link>
                                                        : <span className="shrink-0 font-medium">{ipoSymbolText(ipo)}</span>}
                                                    <span className="min-w-0 grow truncate">{ipo.issuer_name}</span>
                                                    <span className="text-muted-foreground shrink-0 tabular-nums">{offerPriceText(ipo)}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                </Block>
                <Block action={<MoreLink to="/market-holidays">All holidays</MoreLink>} title="Next market holiday">
                    {holiday.isLoading
                        ? <Skeleton className="h-10 w-full" />
                        : holiday.data
                            ? (
                                    <div className="flex items-baseline gap-3" data-testid="landing-holiday">
                                        <span className="text-sm font-medium">{formatDay(holiday.data.day)}</span>
                                        <span>{holiday.data.event_name}</span>
                                        <Badge variant="outline">{holidayStatus(holiday.data)}</Badge>
                                    </div>
                                )
                            : <p className="text-muted-foreground">No holiday announced ahead.</p>}
                </Block>
            </div>

            <section className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold">Browse</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="browse-cards">
                    {BROWSE_CARDS.map(card => (
                        <Link className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" key={card.label} search={card.search} to={card.to}>
                            <Card className="border-border/60 hover:border-primary/60 h-full transition" size="sm">
                                <CardHeader className="gap-1">
                                    <CardTitle className="flex items-center gap-2">
                                        <card.icon className="text-muted-foreground size-4" />
                                        {card.label}
                                    </CardTitle>
                                    <CardDescription>{card.description}</CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                </div>
            </section>

            {recents.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h2 className="text-sm font-semibold">Recently opened</h2>
                    <div className="flex flex-wrap gap-2" data-testid="landing-recents">
                        {recents.map(recent => (
                            recent.kind === "filer"
                                ? (
                                        <Link className="hover:bg-muted/50 flex items-center gap-2 rounded-md border px-2 py-1" key={`filer-${recent.ref}`} params={{ cik: recent.ref }} to="/sec/$cik">
                                            <span className="font-medium">{recent.label}</span>
                                            {recent.badge && <Badge variant="outline">{recent.badge}</Badge>}
                                        </Link>
                                    )
                                : (
                                        <Link className="hover:bg-muted/50 flex items-center gap-2 rounded-md border px-2 py-1" key={`instrument-${recent.ref}`} params={{ ticker: recent.ref }} to="/$ticker">
                                            <span className="font-medium">{recent.label}</span>
                                            <span className="text-muted-foreground max-w-48 truncate">{recent.name}</span>
                                        </Link>
                                    )
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

/**
 * The landing page (behind the key gate: without a key the onboarding card shows instead): live calls, the week's
 * earnings, next IPOs, the next holiday (4 requests, 1 credit each), Browse, recents and the SEC filer lookup.
 */
function IndexPage() {
    const recents = useTickerStore(selectRecents);

    const [now] = React.useState(() => new Date());

    const today = zonedDate(now, NEW_YORK);

    const week = calendarPresetWindow("this-week", now);

    const live = useV2LiveEvents();

    const events = useV2EventsInfinite({ limit: 100, scheduledAtGte: today, scheduledAtLte: week.to, sort: "scheduled_at", toastErrors: false });

    const ipos = useV2IposInfinite({ limit: 5, listingDateGte: today, sort: "listing_date" });

    const holidays = useV2MarketHolidaysInfinite({ dateGte: today, limit: 1, sort: "date" });

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:px-8">
            <section className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">Invinite Data</h1>
                <p className="text-muted-foreground max-w-3xl text-sm">
                    What the Invinite Data API serves today: live earnings calls, the calendar, IPOs and holidays, and every US
                    stock, ETF, closed-end fund, ETN and 13F institution. Search with ⌘K.
                </p>
            </section>
            <LandingView
                holiday={{ data: holidays.data?.pages.at(0)?.data.at(0) ?? null, isLoading: holidays.isLoading }}
                ipos={{ data: ipos.data?.pages.at(0)?.data ?? [], isLoading: ipos.isLoading }}
                live={{ asOf: new Date(live.dataUpdatedAt), data: live.data?.data ?? [], isLoading: live.isLoading }}
                recents={recents}
                today={today}
                week={{ data: events.data?.pages.flatMap(page => page.data) ?? [], isLoading: events.isLoading }}
            />
            <Card className="border-border/60" size="sm">
                <CardHeader>
                    <CardTitle>SEC filers</CardTitle>
                    <CardDescription>Any SEC filer by CIK or name — including pre-IPO issuers, SPACs and 13F managers without a ticker.</CardDescription>
                </CardHeader>
                <CardContent>
                    <SecFilerLookup />
                </CardContent>
            </Card>
        </div>
    );
}
