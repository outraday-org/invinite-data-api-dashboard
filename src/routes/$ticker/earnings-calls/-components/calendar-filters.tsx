import { z } from "zod";

import type { EarningsDateStatus, EarningsEventType, EarningsSession } from "@/lib/api/types";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { orderedWindow } from "@/lib/earnings/format";

export const DATE_STATUSES = [
    "confirmed",
    "unconfirmed",
    "estimated",
    "postponed",
    "cancelled",
] as const satisfies ReadonlyArray<EarningsDateStatus>;

const SESSIONS = ["bmo", "amc", "intraday"] as const satisfies ReadonlyArray<EarningsSession>;

const EVENT_TYPES = [
    "earnings_call",
    "investor_day",
    "conference",
    "agm",
    "other",
    "all",
] as const satisfies ReadonlyArray<EarningsEventType>;

// Every field optional: a bare `/$ticker/earnings-calendar` link means "around today";
// an invalid value falls back to its default instead of failing the route.
const calendarSearchSchema = z.object({
    eventType: z.enum(EVENT_TYPES).optional().catch(undefined),
    from: z.iso.date().optional().catch(undefined),
    session: z.enum(SESSIONS).optional().catch(undefined),
    status: z.enum(DATE_STATUSES).optional().catch(undefined),
    to: z.iso.date().optional().catch(undefined),
});

export type CalendarSearch = z.infer<typeof calendarSearchSchema>;

/** `validateSearch` of the calendar route: a `from > to` pair is swapped, not rejected. */
export function validateCalendarSearch(search: Record<string, unknown>): CalendarSearch {
    return orderedWindow(calendarSearchSchema.parse(search));
}

const STATUS_OPTIONS: Array<{ label: string; value: "all" | EarningsDateStatus }> = [
    { label: "All statuses", value: "all" },
    { label: "Confirmed", value: "confirmed" },
    { label: "Unconfirmed", value: "unconfirmed" },
    { label: "Estimated", value: "estimated" },
    { label: "Postponed", value: "postponed" },
    { label: "Cancelled", value: "cancelled" },
];

const SESSION_OPTIONS: Array<{ label: string; value: "all" | EarningsSession }> = [
    { label: "All sessions", value: "all" },
    { label: "Before open", value: "bmo" },
    { label: "After close", value: "amc" },
    { label: "Intraday", value: "intraday" },
];

// Omitted = the API's default `earnings_call`; "All events" sends `event_type=all`.
const EVENT_TYPE_OPTIONS: Array<{ label: string; value: EarningsEventType }> = [
    { label: "Earnings calls", value: "earnings_call" },
    { label: "All events", value: "all" },
    { label: "Investor days", value: "investor_day" },
    { label: "Conferences", value: "conference" },
    { label: "AGMs", value: "agm" },
    { label: "Other events", value: "other" },
];

function FilterSelect<T extends string>({
    className,
    onValueChange,
    options,
    value,
}: {
    className: string;
    onValueChange: (value: T) => void;
    options: Array<{ label: string; value: T }>;
    value: T;
}) {
    return (
        <Select onValueChange={v => onValueChange(v as T)} value={value}>
            <SelectTrigger className={className}>
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
                aria-label="From"
                className="w-[150px]"
                onChange={e => onChange({ from: e.target.value || undefined })}
                type="date"
                value={from}
            />
            <span className="text-muted-foreground text-xs">to</span>
            <Input
                aria-label="To"
                className="w-[150px]"
                onChange={e => onChange({ to: e.target.value || undefined })}
                type="date"
                value={to}
            />
            <FilterSelect
                className="w-[150px]"
                onValueChange={value => onChange({ status: value === "all" ? undefined : value })}
                options={STATUS_OPTIONS}
                value={search.status ?? "all"}
            />
            <FilterSelect
                className="w-[140px]"
                onValueChange={value => onChange({ session: value === "all" ? undefined : value })}
                options={SESSION_OPTIONS}
                value={search.session ?? "all"}
            />
            <FilterSelect
                className="w-[150px]"
                onValueChange={value => onChange({ eventType: value === "earnings_call" ? undefined : value })}
                options={EVENT_TYPE_OPTIONS}
                value={search.eventType ?? "earnings_call"}
            />
        </div>
    );
}
