import { createFileRoute, Link } from "@tanstack/react-router";
import { Braces, ChevronRightIcon } from "lucide-react";
import * as React from "react";

import type { V2Event, V2Ipo, V2MarketHoliday } from "@/lib/api/types";
import type { ApiFamily } from "@/lib/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2EventsInfinite, useV2IposInfinite, useV2LiveEvents, useV2MarketHolidaysInfinite } from "@/lib/api/queries";
import { calendarPresetWindow } from "@/lib/earnings/calendar-groups";
import { callCalendarDate, eventLabel, formatStartedAgo, zonedDate } from "@/lib/earnings/format";
import { formatDay, formatInstantShort } from "@/lib/format";
import { titleHead } from "@/lib/layout";
import { API_FAMILIES, API_FAMILY_OPERATIONS } from "@/lib/navigation";
import { useRequestPanelStore } from "@/lib/stores/request-panel-store";
import { EventLink } from "@/routes/$ticker/earnings-calls/-components/event-link";
import { LiveDot } from "@/routes/$ticker/earnings-calls/-components/live-dot";
import { holidayStatus } from "@/routes/market-holidays";

import { ipoListedTicker, ipoSymbolText } from "./ipo-calendar";

export const Route = createFileRoute("/")({
    component: IndexPage,
    head: () => titleHead(),
});

const NEW_YORK = "America/New_York";

/** Rows per landing block: the first N in the API's order (an event carries no market cap or rank to order by). */
export const LANDING_ROWS = 8;

export type LandingData = {
    holiday: LandingBlock<null | V2MarketHoliday>;
    ipos: LandingBlock<ReadonlyArray<V2Ipo>>;
    live: LandingBlock<ReadonlyArray<V2Event>> & { asOf: Date };
    today: string;
    week: LandingBlock<ReadonlyArray<V2Event>>;
};

/** One block's answer; `failed` = its request failed (never shown as "nothing ahead"). */
type LandingBlock<T> = { data: T; failed?: boolean; isLoading: boolean };

type MorePage = "/calendar" | "/ipo-calendar" | "/live-calls" | "/market-holidays";

/** A failed list's one line (its page has the details); the other lists still render. */
function Failed() {
    return <p className="text-destructive">Could not load this list. Open its page for details.</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
    return <p className="text-muted-foreground">{children}</p>;
}

function MoreLink({ children, to }: { children: React.ReactNode; to: MorePage }) {
    return (
        <Link className="text-primary inline-flex min-h-9 items-center gap-0.5 text-xs whitespace-nowrap underline-offset-4 hover:underline sm:min-h-0" to={to}>
            {children}
            <ChevronRightIcon aria-hidden className="size-3.5" />
        </Link>
    );
}

/** Skeleton rows in the shape of an event row (two lines), not a grey box. */
function SkeletonRows() {
    return (
        <ul aria-hidden className="flex flex-col">
            {["a", "b", "c"].map(key => (
                <li className="flex flex-col gap-1.5 py-2" key={key}>
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </li>
            ))}
        </ul>
    );
}

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });

const WEEKDAY_UTC = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });

/** "1:00 PM EST" in the viewer's zone; a date-only call (midnight UTC of its day) has no time yet. */
function callTimeShort(event: V2Event) {
    return event.call_time_source === null ? "Time TBA" : formatInstantShort(event.scheduled_at);
}

/** "Thu · 1:00 PM EST" (the weekday in the viewer's zone); a date-only call names its calendar day only ("Thu"). */
function callDayTimeShort(event: V2Event) {
    const at = new Date(event.scheduled_at);

    if (Number.isNaN(at.getTime())) return event.scheduled_at;

    if (event.call_time_source === null) return WEEKDAY_UTC.format(at);

    return `${WEEKDAY.format(at)} · ${formatInstantShort(event.scheduled_at)}`;
}

/**
 * One call as a two-line row, the whole row a link: symbol, period and time (never wrapped) on the first line, the
 * company name muted on the second.
 */
function EventRow({ event, live, time }: { event: V2Event; live?: boolean; time: string }) {
    return (
        <li>
            <EventLink className="hover:bg-muted/50 -mx-2 flex min-h-11 flex-col justify-center gap-0.5 rounded-md px-2 py-1.5" event={event}>
                <span className="flex min-w-0 items-center gap-2">
                    {live && <LiveDot className="shrink-0" />}
                    <span className="shrink-0 font-medium">{event.symbol}</span>
                    <span className="text-muted-foreground min-w-0 truncate text-xs">{eventLabel(event)}</span>
                    <span className="text-muted-foreground ml-auto shrink-0 whitespace-nowrap tabular-nums">{time}</span>
                </span>
                <span className="text-muted-foreground truncate">{event.company_name}</span>
            </EventLink>
        </li>
    );
}

/** A column of "Today": title (+ count) and its link, then the rows / state. */
function TodayColumn({ action, children, count, testId, title }: { action: React.ReactNode; children: React.ReactNode; count?: number; testId: string; title: string }) {
    return (
        <div className="flex min-w-0 flex-col gap-1 py-4 first:pt-0 last:pb-0 lg:px-5 lg:py-0 lg:first:pl-0 lg:last:pr-0" data-testid={testId}>
            <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">
                    {title}
                    {count !== undefined && count > 0 && <span className="text-muted-foreground ml-1.5 tabular-nums">{count}</span>}
                </h3>
                {action}
            </div>
            {children}
        </div>
    );
}

function EventColumnBody({ block, empty, events, time }: { block: LandingBlock<unknown>; empty: string; events: ReadonlyArray<V2Event>; time: (event: V2Event) => string }) {
    if (block.failed) return <Failed />;

    if (block.isLoading) return <SkeletonRows />;

    if (events.length === 0) return <Empty>{empty}</Empty>;

    return <ul className="flex flex-col">{events.map(event => <EventRow event={event} key={event.event_id} time={time(event)} />)}</ul>;
}

function LiveColumnBody({ live }: { live: LandingData["live"] }) {
    if (live.failed) return <Failed />;

    if (live.isLoading) return <SkeletonRows />;

    if (live.data.length === 0) return <Empty>No call is live right now.</Empty>;

    return (
        <ul className="flex flex-col" data-testid="landing-live">
            {live.data.slice(0, LANDING_ROWS).map(event => (
                <EventRow event={event} key={event.event_id} live time={event.started_at ? formatStartedAgo(event.started_at, live.asOf) : "starting"} />
            ))}
            {live.data.length > LANDING_ROWS && <li><MoreLink to="/live-calls">{`+${live.data.length - LANDING_ROWS} more`}</MoreLink></li>}
        </ul>
    );
}

/** One compact line under "Today": label, the content (or its state), the page link. */
function CompactLine({ action, children, label, testId }: { action: React.ReactNode; children: React.ReactNode; label: string; testId?: string }) {
    return (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" data-testid={testId}>
            <span className="font-medium">{label}</span>
            {children}
            {action}
        </div>
    );
}

function IpoLine({ ipos }: { ipos: LandingData["ipos"] }) {
    const action = <MoreLink to="/ipo-calendar">IPO calendar</MoreLink>;

    if (ipos.failed) return <CompactLine action={action} label="Next IPOs"><Failed /></CompactLine>;

    if (ipos.isLoading) return <CompactLine action={action} label="Next IPOs"><Skeleton className="h-3.5 w-48" /></CompactLine>;

    if (ipos.data.length === 0) return <CompactLine action={action} label="Next IPOs"><Empty>No IPO with a listing date ahead.</Empty></CompactLine>;

    return (
        <CompactLine action={action} label="Next IPOs" testId="landing-ipos">
            {ipos.data.map((ipo) => {
                const listed = ipoListedTicker(ipo);

                const symbol = ipoSymbolText(ipo);

                return (
                    <span className="inline-flex items-baseline gap-1.5" key={ipo.ipo_id}>
                        {listed
                            ? <Link className="font-medium hover:underline max-sm:inline-flex max-sm:min-h-9 max-sm:items-center" params={{ ticker: listed }} title={ipo.issuer_name} to="/$ticker">{listed}</Link>
                            : <span title={ipo.issuer_name}>{symbol === "—" ? ipo.issuer_name : symbol}</span>}
                        <span className="text-muted-foreground whitespace-nowrap tabular-nums">{formatDay(ipo.listing_date)}</span>
                    </span>
                );
            })}
        </CompactLine>
    );
}

function HolidayLine({ holiday }: { holiday: LandingData["holiday"] }) {
    const action = <MoreLink to="/market-holidays">All holidays</MoreLink>;

    if (holiday.failed) return <CompactLine action={action} label="Next market holiday"><Failed /></CompactLine>;

    if (holiday.isLoading) return <CompactLine action={action} label="Next market holiday"><Skeleton className="h-3.5 w-40" /></CompactLine>;

    if (!holiday.data) return <CompactLine action={action} label="Next market holiday"><Empty>No holiday announced ahead.</Empty></CompactLine>;

    return (
        <CompactLine action={action} label="Next market holiday" testId="landing-holiday">
            <span>{holiday.data.event_name}</span>
            <span className="text-muted-foreground whitespace-nowrap tabular-nums">{formatDay(holiday.data.day)}</span>
            <Badge variant="outline">{holidayStatus(holiday.data)}</Badge>
        </CompactLine>
    );
}

/** A coverage row's link: a ticker page opens its example symbol. */
function FamilyLink({ children, className, family }: { children: React.ReactNode; className: string; family: ApiFamily }) {
    const { link } = family;

    if (link.to === "/$ticker/financials") return <Link className={className} params={link.params} to={link.to}>{children}</Link>;

    return <Link className={className} to={link.to}>{children}</Link>;
}

/** "What the API covers": one row per data family, its operation count computed from the operations table. */
function CoverageList() {
    return (
        <ul className="grid lg:grid-cols-2 lg:gap-x-8" data-testid="api-families">
            {API_FAMILIES.map((family) => {
                const count = API_FAMILY_OPERATIONS[family.id].length;

                return (
                    <li className="border-b" key={family.id}>
                        <FamilyLink className="hover:bg-muted/50 -mx-2 flex min-h-12 items-center gap-4 rounded-md px-2 py-2.5" family={family}>
                            <span className="flex min-w-0 grow flex-col gap-0.5">
                                <span className="font-medium">{family.label}</span>
                                <span className="text-muted-foreground">{family.description}</span>
                            </span>
                            <span className="text-muted-foreground shrink-0 whitespace-nowrap tabular-nums" data-testid="family-count">
                                {`${count} ${count === 1 ? "operation" : "operations"}`}
                            </span>
                            <ChevronRightIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
                        </FamilyLink>
                    </li>
                );
            })}
        </ul>
    );
}

/** The page's title and the one sentence that teaches the request panel ("API" opens it, as the top bar's toggle). */
function LandingIntro() {
    const setOpen = useRequestPanelStore(state => state.setOpen);

    return (
        <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Invinite Data API, live</h1>
            <p className="text-muted-foreground max-w-[68ch] text-sm">
                {"Every page here is built from Data API requests. Open "}
                <Button className="mx-0.5 align-baseline" onClick={() => setOpen(true)} size="xs" type="button" variant="outline">
                    <Braces className="size-3" />
                    API
                </Button>
                {" at the top right to see them."}
            </p>
        </div>
    );
}

/**
 * The landing page with data (pure but for the intro's request-panel button): the intro, "Today" (live calls, today's
 * and the rest of this week's earnings — the first N —, the next IPOs and market holiday), what the API covers (the
 * data families of `API_FAMILIES`), the recently opened subjects and the SEC filer lookup.
 */
export function LandingView({ holiday, ipos, live, today, week }: LandingData) {
    const todays = week.data.filter(event => callCalendarDate(event, NEW_YORK) === today);

    const later = week.data.filter(event => callCalendarDate(event, NEW_YORK) > today);

    const operationCount = Object.values(API_FAMILY_OPERATIONS).reduce((sum, ids) => sum + ids.length, 0);

    return (
        <>
            <LandingIntro />

            <Section title="Today">
                <div className="flex flex-col divide-y lg:grid lg:grid-cols-3 lg:divide-x lg:divide-y-0">
                    <TodayColumn action={<MoreLink to="/live-calls">All live calls</MoreLink>} count={live.failed || live.isLoading ? undefined : live.data.length} testId="landing-live-column" title="Live now">
                        <LiveColumnBody live={live} />
                    </TodayColumn>
                    <TodayColumn action={<MoreLink to="/calendar">Calendar</MoreLink>} testId="landing-today-column" title="Earnings today">
                        <EventColumnBody block={week} empty="No earnings call today." events={todays.slice(0, LANDING_ROWS)} time={callTimeShort} />
                    </TodayColumn>
                    <TodayColumn action={<MoreLink to="/calendar">Calendar</MoreLink>} testId="landing-week-column" title="This week">
                        <EventColumnBody block={week} empty="No more calls this week." events={later.slice(0, LANDING_ROWS)} time={callDayTimeShort} />
                    </TodayColumn>
                </div>
                <div className="flex flex-col gap-4 border-t pt-4">
                    <IpoLine ipos={ipos} />
                    <HolidayLine holiday={holiday} />
                </div>
            </Section>

            <Section description={`${operationCount} HTTP operations in ${API_FAMILIES.length} families, plus one WebSocket stream.`} title="What the API covers">
                <CoverageList />
            </Section>

        </>
    );
}

/**
 * The landing page (behind the key gate: without a key the onboarding card shows instead): live calls, the week's
 * earnings, next IPOs, the next holiday (4 requests, 1 credit each), and what the API covers.
 */
function IndexPage() {
    const [now] = React.useState(() => new Date());

    const today = zonedDate(now, NEW_YORK);

    const week = calendarPresetWindow("this-week", now);

    const live = useV2LiveEvents();

    const events = useV2EventsInfinite({ limit: 100, scheduledAtGte: today, scheduledAtLte: week.to, sort: "scheduled_at", toastErrors: false });

    const ipos = useV2IposInfinite({ limit: 5, listingDateGte: today, sort: "listing_date" });

    const holidays = useV2MarketHolidaysInfinite({ dateGte: today, limit: 1, sort: "date" });

    return (
        <PageContainer className="gap-8">
            <LandingView
                holiday={{ data: holidays.data?.pages.at(0)?.data.at(0) ?? null, failed: Boolean(holidays.error), isLoading: holidays.isLoading }}
                ipos={{ data: ipos.data?.pages.at(0)?.data ?? [], failed: Boolean(ipos.error), isLoading: ipos.isLoading }}
                live={{ asOf: new Date(live.dataUpdatedAt), data: live.data?.data ?? [], failed: Boolean(live.error) && !live.data, isLoading: live.isLoading }}
                today={today}
                week={{ data: events.data?.pages.flatMap(page => page.data) ?? [], failed: Boolean(events.error), isLoading: events.isLoading }}
            />
        </PageContainer>
    );
}
