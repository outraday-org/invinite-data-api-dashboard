import { z } from "zod";

import type {
    V2CalendarStatus,
    V2DateKind,
    V2EventStatus,
    V2EventType,
    V2Session,
} from "@/lib/api/types";

import { DayRange } from "@/components/ui/day-range";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { orderedWindow } from "@/lib/url-state";

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
    // A ticker (`company`); the calendar then lists that company's calls in the window.
    company: z.string().trim().min(1).max(15).optional().catch(undefined),
    // Date certainty (`date_kind`); omitted = any.
    dateKind: z.enum(DATE_KINDS).optional().catch(undefined),
    eventType: z.enum(EVENT_TYPES).optional().catch(undefined),
    fiscalQuarter: z.coerce.number().int().min(1).max(4).optional().catch(undefined),
    fiscalYear: z.coerce.number().int().min(1900).max(2200).optional().catch(undefined),
    from: z.iso.date().optional().catch(undefined),
    session: z.enum(SESSIONS).optional().catch(undefined),
    status: z.enum(EVENT_STATUSES).optional().catch(undefined),
    to: z.iso.date().optional().catch(undefined),
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

/** A labelled `Select` over fixed options (the calendar and News filters). */
export function FilterSelect<T extends string>({
    "aria-label": ariaLabel,
    className,
    disabled,
    onValueChange,
    options,
    title,
    value,
}: {
    /** Required: a select's trigger shows its value, not what it filters (F102). */
    "aria-label": string;
    "className": string;
    "disabled"?: boolean;
    "onValueChange": (value: T) => void;
    "options": Array<{ label: string; value: T }>;
    "title"?: string;
    "value": T;
}) {
    return (
        <Select disabled={disabled} onValueChange={v => onValueChange(v as T)} value={value}>
            <SelectTrigger aria-label={ariaLabel} className={className} title={title}>
                {options.find(opt => opt.value === value)?.label}
            </SelectTrigger>
            <SelectContent>
                {options.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/**
 * Whether a loaded row passes the filters `/v1/events` has no parameter for: the session and the event status
 * (`calendar.status`, `expand=calendar`).
 */
export function matchesCalendarSearch(
    event: { calendar?: null | { status: null | V2CalendarStatus }; session: null | V2Session },
    search: Pick<CalendarSearch, "calendarStatus" | "session">,
) {
    if (search.session && event.session !== search.session) return false;

    return !search.calendarStatus || event.calendar?.status === search.calendarStatus;
}

/** Calendar filters, controlled by the route's search params (a filter set is a shareable URL). */
export function CalendarFilters({
    from,
    onChange,
    search,
    to,
}: {
    /** The resolved window (search or default), shown in the date inputs. */
    from: string;
    onChange: (patch: Partial<CalendarSearch>) => void;
    search: CalendarSearch;
    to: string;
}) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Input
                aria-label="Symbol"
                className="w-[110px] uppercase placeholder:normal-case"
                defaultValue={search.company ?? ""}
                key={search.company ?? ""}
                onBlur={event => onChange({ company: event.target.value.trim().toUpperCase() || undefined })}
                onKeyDown={(event) => {
                    if (event.key === "Enter") onChange({ company: event.currentTarget.value.trim().toUpperCase() || undefined });
                }}
                placeholder="Symbol"
            />
            <DayRange from={from} labels={{ from: "From", to: "To" }} onChange={onChange} separatorClassName="text-muted-foreground text-xs" to={to} />
            <FilterSelect
                aria-label="Session"
                className="w-[140px]"
                onValueChange={value => onChange({ session: value === "all" ? undefined : value })}
                options={SESSION_OPTIONS}
                value={search.session ?? "all"}
            />
            <FilterSelect
                aria-label="Event type"
                className="w-[150px]"
                onValueChange={value => onChange({ eventType: value === "earnings_call" ? undefined : value })}
                options={EVENT_TYPE_OPTIONS}
                value={search.eventType ?? "earnings_call"}
            />
            <FilterSelect
                aria-label="Date certainty"
                className="w-[150px]"
                onValueChange={value => onChange({ dateKind: value === "any" ? undefined : value })}
                options={DATE_KIND_OPTIONS}
                value={search.dateKind ?? "any"}
            />
            <FilterSelect
                aria-label="Call status"
                className="w-[150px]"
                onValueChange={value => onChange({ status: value === "all" ? undefined : value })}
                options={STATUS_OPTIONS}
                value={search.status ?? "all"}
            />
            <FilterSelect
                aria-label="Event status"
                className="w-[170px]"
                onValueChange={value => onChange({ calendarStatus: value === "all" ? undefined : value })}
                options={CALENDAR_STATUS_OPTIONS}
                value={search.calendarStatus ?? "all"}
            />
            <Input
                aria-label="Fiscal year"
                className="w-[110px]"
                defaultValue={search.fiscalYear ?? ""}
                key={`fy-${search.fiscalYear ?? ""}`}
                max={2200}
                min={1900}
                onBlur={(event) => {
                    const year = Number(event.target.value);

                    onChange({ fiscalYear: Number.isInteger(year) && year >= 1900 ? year : undefined });
                }}
                placeholder="Fiscal year"
                type="number"
            />
            <FilterSelect
                aria-label="Fiscal quarter"
                className="w-[120px]"
                onValueChange={value => onChange({ fiscalQuarter: value === "all" ? undefined : Number(value) })}
                options={QUARTER_OPTIONS}
                value={search.fiscalQuarter ? String(search.fiscalQuarter) as "1" | "2" | "3" | "4" : "all"}
            />
        </div>
    );
}
