import { z } from "zod";

import type {
    V2CalendarStatus,
    V2DateKind,
    V2Event,
    V2EventStatus,
    V2EventType,
    V2Session,
} from "@/lib/api/types";

import { CompanyFilter } from "@/components/search/company-filter";
import { DayRange } from "@/components/ui/day-range";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { joinCompanyList, parseCompanyList } from "@/lib/company-list";
import { isReplayCapture } from "@/lib/earnings/capture-mode";
import { optionalCompanyList, orderedWindow } from "@/lib/url-state";

const SESSIONS = ["bmo", "amc", "intraday"] as const satisfies ReadonlyArray<V2Session>;

const EVENT_TYPES = [
    "earnings_call",
    "investor_day",
    "conference",
    "agm",
    "other",
    "all",
] as const satisfies ReadonlyArray<V2EventType>;

/** `calendar.status`, most decisive first (the API's order). */
export const CALENDAR_STATUSES = [
    "cancelled",
    "postponed",
    "reported",
    "confirmed",
    "announced",
    "estimated",
] as const satisfies ReadonlyArray<V2CalendarStatus>;

/** `date_kind` of `/v1/events` = date certainty (`any` is the default, never sent). */
const DATE_KINDS = ["confirmed", "estimated"] as const satisfies ReadonlyArray<V2DateKind>;

/** `status` of `/v1/events`: where the call stands (omitted = every status, cancelled included). */
const EVENT_STATUSES = ["upcoming", "live", "ended"] as const satisfies ReadonlyArray<V2EventStatus>;

// Every field optional: a bare `/calendar` link means "around today";
// an invalid value falls back to its default instead of failing the route.
const calendarSearchSchema = z.object({
    // `calendarStatus` and `session` have no `/v1/events` filter: they filter the loaded rows (`matchesCalendarSearch`).
    calendarStatus: z.enum(CALENDAR_STATUSES).optional().catch(undefined),
    // Tickers / CIKs (`company`, a comma list of ≤ 50); the calendar then lists those companies' calls.
    company: optionalCompanyList(),
    // Date certainty (`date_kind`); omitted = any.
    dateKind: z.enum(DATE_KINDS).optional().catch(undefined),
    // The New York day the week strip shows (its week is the request window); absent = today.
    day: z.iso.date().optional().catch(undefined),
    eventType: z.enum(EVENT_TYPES).optional().catch(undefined),
    fiscalQuarter: z.coerce.number().int().min(1).max(4).optional().catch(undefined),
    fiscalYear: z.coerce.number().int().min(1900).max(2200).optional().catch(undefined),
    from: z.iso.date().optional().catch(undefined),
    session: z.enum(SESSIONS).optional().catch(undefined),
    status: z.enum(EVENT_STATUSES).optional().catch(undefined),
    to: z.iso.date().optional().catch(undefined),
    // A day of the week the strip shows (absent = the selected day's week): browsing weeks never changes `day`.
    week: z.iso.date().optional().catch(undefined),
});

export type CalendarSearch = z.infer<typeof calendarSearchSchema>;

/** `validateSearch` of the calendar route: a `from > to` pair is swapped, not rejected. */
export function validateCalendarSearch(search: Record<string, unknown>): CalendarSearch {
    return orderedWindow(calendarSearchSchema.parse(search));
}

const SESSION_OPTIONS: Array<{ label: string; value: "all" | V2Session }> = [
    { label: "All sessions", value: "all" },
    { label: "Before open", value: "bmo" },
    { label: "After close", value: "amc" },
    { label: "Intraday", value: "intraday" },
];

// Omitted = the API's default `earnings_call`; "All events" sends `event_type=all`.
const EVENT_TYPE_OPTIONS: Array<{ label: string; value: V2EventType }> = [
    { label: "Earnings calls", value: "earnings_call" },
    { label: "All events", value: "all" },
    { label: "Investor days", value: "investor_day" },
    { label: "Conferences", value: "conference" },
    { label: "AGMs", value: "agm" },
    { label: "Other events", value: "other" },
];

const DATE_KIND_OPTIONS: Array<{ label: string; value: "any" | V2DateKind }> = [
    { label: "Any date", value: "any" },
    { label: "Confirmed date", value: "confirmed" },
    { label: "Estimated date", value: "estimated" },
];

const STATUS_OPTIONS: Array<{ label: string; value: "all" | V2EventStatus }> = [
    { label: "Any call status", value: "all" },
    { label: "Upcoming", value: "upcoming" },
    { label: "Live", value: "live" },
    { label: "Ended", value: "ended" },
];

const QUARTER_OPTIONS: Array<{ label: string; value: "1" | "2" | "3" | "4" | "all" }> = [
    { label: "Any quarter", value: "all" },
    { label: "Q1", value: "1" },
    { label: "Q2", value: "2" },
    { label: "Q3", value: "3" },
    { label: "Q4", value: "4" },
];

const CALENDAR_STATUS_OPTIONS: Array<{ label: string; value: "all" | V2CalendarStatus }> = [
    { label: "Any event status", value: "all" },
    { label: "Reported", value: "reported" },
    { label: "Confirmed", value: "confirmed" },
    { label: "Announced", value: "announced" },
    { label: "Estimated", value: "estimated" },
    { label: "Postponed", value: "postponed" },
    { label: "Cancelled", value: "cancelled" },
];

/**
 * Whether a loaded row passes the filters `/v1/events` has no parameter for: the session and the event status
 * (`calendar.status`, `expand=calendar`). Call status "Live" also drops a replay capture (`capture_mode` `replay`): the
 * API's `status=live` counts a capturing replay, which the badge reads as "Replay", not live.
 */
export function matchesCalendarSearch(
    event: Pick<V2Event, "capture_mode"> & { calendar?: null | { status: null | V2CalendarStatus }; session: null | V2Session },
    search: Pick<CalendarSearch, "calendarStatus" | "session" | "status">,
) {
    if (search.session && event.session !== search.session) return false;

    if (search.status === "live" && isReplayCapture(event)) return false;

    return !search.calendarStatus || event.calendar?.status === search.calendarStatus;
}

/**
 * The calendar filters a reader sets, cleared — the custom day range too (back to the week strip); the strip's day is
 * not a filter.
 */
const FILTER_RESET = {
    calendarStatus: undefined,
    company: undefined,
    dateKind: undefined,
    eventType: undefined,
    fiscalQuarter: undefined,
    fiscalYear: undefined,
    from: undefined,
    session: undefined,
    status: undefined,
    to: undefined,
} satisfies Partial<CalendarSearch>;

/** The filters behind "More filters" (rarely needed); the day range counts once. */
const MORE_KEYS = ["company", "dateKind", "status", "calendarStatus", "fiscalYear", "fiscalQuarter"] as const satisfies ReadonlyArray<keyof CalendarSearch>;

const MAIN_KEYS = ["eventType", "session"] as const satisfies ReadonlyArray<keyof CalendarSearch>;

/**
 * Calendar filters: one labelled `FilterBar`, controlled by the route's search params (a filter set is a shareable URL).
 * Event type and session stay in view; the companies (`CompanyFilter`), date certainty, call / event status, fiscal year / quarter and a custom
 * day range (instead of the week strip) sit behind "More filters". "Reset filters" clears them all, never the strip's day.
 */
export function CalendarFilters({ onChange, search }: { onChange: (patch: Partial<CalendarSearch>) => void; search: CalendarSearch }) {
    const rangeSet = search.from !== undefined || search.to !== undefined ? 1 : 0;

    const moreActiveCount = MORE_KEYS.filter(key => search[key] !== undefined).length + rangeSet;

    const activeCount = MAIN_KEYS.filter(key => search[key] !== undefined).length + moreActiveCount;

    return (
        <FilterBar activeCount={activeCount} more={<MoreCalendarFilters onChange={onChange} search={search} />} moreActiveCount={moreActiveCount} onReset={() => onChange(FILTER_RESET)}>
            <FilterField label="Session">
                {id => (
                    <FilterSelect
                        aria-label="Session"
                        className="w-full"
                        id={id}
                        onValueChange={value => onChange({ session: value === "all" ? undefined : value })}
                        options={SESSION_OPTIONS}
                        value={search.session ?? "all"}
                    />
                )}
            </FilterField>
            <FilterField label="Event type">
                {id => (
                    <FilterSelect
                        aria-label="Event type"
                        className="w-full"
                        id={id}
                        onValueChange={value => onChange({ eventType: value === "earnings_call" ? undefined : value })}
                        options={EVENT_TYPE_OPTIONS}
                        value={search.eventType ?? "earnings_call"}
                    />
                )}
            </FilterField>
        </FilterBar>
    );
}

/** The fields behind "More filters". */
function MoreCalendarFilters({ onChange, search }: { onChange: (patch: Partial<CalendarSearch>) => void; search: CalendarSearch }) {
    return (
        <>
            <FilterField label="Companies" span={2}>
                {id => (
                    <CompanyFilter id={id} onChange={companies => onChange({ company: joinCompanyList(companies) })} value={parseCompanyList(search.company)} />
                )}
            </FilterField>
            <FilterField label="Date certainty">
                {id => (
                    <FilterSelect
                        aria-label="Date certainty"
                        className="w-full"
                        id={id}
                        onValueChange={value => onChange({ dateKind: value === "any" ? undefined : value })}
                        options={DATE_KIND_OPTIONS}
                        value={search.dateKind ?? "any"}
                    />
                )}
            </FilterField>
            <FilterField label="Call status">
                {id => (
                    <FilterSelect
                        aria-label="Call status"
                        className="w-full"
                        id={id}
                        onValueChange={value => onChange({ status: value === "all" ? undefined : value })}
                        options={STATUS_OPTIONS}
                        value={search.status ?? "all"}
                    />
                )}
            </FilterField>
            <FilterField label="Event status">
                {id => (
                    <FilterSelect
                        aria-label="Event status"
                        className="w-full"
                        id={id}
                        onValueChange={value => onChange({ calendarStatus: value === "all" ? undefined : value })}
                        options={CALENDAR_STATUS_OPTIONS}
                        value={search.calendarStatus ?? "all"}
                    />
                )}
            </FilterField>
            <FilterField label="Fiscal year">
                {id => (
                    <Input
                        aria-label="Fiscal year"
                        className="w-full"
                        defaultValue={search.fiscalYear ?? ""}
                        id={id}
                        key={`fy-${search.fiscalYear ?? ""}`}
                        max={2200}
                        min={1900}
                        onBlur={(event) => {
                            const year = Number(event.target.value);

                            onChange({ fiscalYear: Number.isInteger(year) && year >= 1900 ? year : undefined });
                        }}
                        placeholder="Any year"
                        type="number"
                    />
                )}
            </FilterField>
            <FilterField label="Fiscal quarter">
                {id => (
                    <FilterSelect
                        aria-label="Fiscal quarter"
                        className="w-full"
                        id={id}
                        onValueChange={value => onChange({ fiscalQuarter: value === "all" ? undefined : Number(value) })}
                        options={QUARTER_OPTIONS}
                        value={search.fiscalQuarter ? String(search.fiscalQuarter) as "1" | "2" | "3" | "4" : "all"}
                    />
                )}
            </FilterField>
            <FilterField label="Custom days" span={2}>
                <DayRange from={search.from} labels={{ from: "From", to: "To" }} onChange={onChange} to={search.to} />
            </FilterField>
        </>
    );
}
