import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, isoWeekNumber, weekDaysOf } from "@/lib/earnings/calendar-groups";
import { cn } from "@/lib/utils";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });

const MONTH_DAY = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" });

const YEAR = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric" });

const at = (day: string) => new Date(`${day}T00:00:00Z`);

/** "Nov 23 – 27, 2026" / "Dec 28, 2026 – Jan 1, 2027" for the shown days. */
function weekRangeText(first: string, last: string) {
    const sameYear = first.slice(0, 4) === last.slice(0, 4);

    const sameMonth = sameYear && first.slice(5, 7) === last.slice(5, 7);

    const end = sameMonth ? `${Number(last.slice(8))}, ${YEAR.format(at(last))}` : `${MONTH_DAY.format(at(last))}, ${YEAR.format(at(last))}`;

    return `${MONTH_DAY.format(at(first))}${sameYear ? "" : `, ${YEAR.format(at(first))}`} – ${end}`;
}

export type CalendarWeekStripProps = {
    /** Calls per New York day of the loaded pages; null while the first page loads. */
    counts: null | ReadonlyMap<string, number>;
    /** More pages exist: a count is "at least". */
    countsPartial: boolean;
    /** The selected New York day (the table's day; it may lie outside the shown week). */
    day: string;
    onSelectDay: (day: string) => void;
    /** Shows another week (its Monday) without picking a day of it. */
    onShowWeek: (monday: string) => void;
    /** Today's New York day. */
    today: string;
    /** A day of the shown week. */
    weekOf: string;
};

/**
 * The calendar's week strip (owner, 2026-11-25): one card per weekday of the selected day's week — weekday, day, the
 * number of calls — the selected day filled, today marked; Saturday / Sunday only when they hold a call or are picked.
 * Previous / next week only move the strip (its counts load); the table keeps the selected day until a day card is
 * clicked. "Today" picks today and shows its week.
 */
export function CalendarWeekStrip({ counts, countsPartial, day, onSelectDay, onShowWeek, today, weekOf }: CalendarWeekStripProps) {
    const week = weekDaysOf(weekOf);

    const shown = week.filter((date, index) => index < 5 || date === day || date === today || (counts?.get(date) ?? 0) > 0);

    return (
        <section aria-label="Week" className="flex flex-col gap-2" data-testid="calendar-week-strip">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                    <span className="text-muted-foreground mr-2 text-xs font-medium tracking-wide uppercase">{`Week ${isoWeekNumber(week[0])}`}</span>
                    <span className="font-medium">{weekRangeText(week[0], week[6])}</span>
                </p>
                <div className="flex items-center gap-1">
                    <Button aria-label="Previous week" onClick={() => onShowWeek(addDays(week[0], -7))} size="sm" type="button" variant="ghost">
                        <ChevronLeft />
                        <span className="max-sm:sr-only">Previous week</span>
                    </Button>
                    <Button disabled={day === today && week.includes(today)} onClick={() => onSelectDay(today)} size="sm" type="button" variant="outline">
                        Today
                    </Button>
                    <Button aria-label="Next week" onClick={() => onShowWeek(addDays(week[0], 7))} size="sm" type="button" variant="ghost">
                        <span className="max-sm:sr-only">Next week</span>
                        <ChevronRight />
                    </Button>
                </div>
            </div>
            <div className="grid auto-cols-fr grid-flow-col gap-1.5 sm:gap-2">
                {shown.map((date) => {
                    const selected = date === day;

                    const count = counts?.get(date) ?? 0;

                    const countText = `${count}${countsPartial ? "+" : ""}`;

                    return (
                        <button
                            aria-label={`${WEEKDAY.format(at(date))} ${MONTH_DAY.format(at(date))}${date === today ? ", today" : ""}: ${counts ? `${countText} ${count === 1 ? "call" : "calls"}` : "loading"}`}
                            aria-pressed={selected}
                            className={cn(
                                "group flex min-w-0 flex-col items-start gap-0.5 rounded-md border px-2 py-2 text-left transition-colors sm:px-3",
                                selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted/60",
                                !selected && date === today && "border-primary/60",
                            )}
                            key={date}
                            onClick={() => onSelectDay(date)}
                            type="button"
                        >
                            <span className={cn("flex w-full items-center justify-between gap-1 text-xs font-medium uppercase", selected ? "text-primary-foreground/85" : "text-muted-foreground")}>
                                {WEEKDAY.format(at(date))}
                                {date === today && <span className={cn("truncate normal-case", !selected && "text-primary")}>Today</span>}
                            </span>
                            <span className="text-section truncate tabular-nums">{MONTH_DAY.format(at(date))}</span>
                            {counts
                                ? (
                                        <span className={cn("truncate text-xs tabular-nums", selected ? "text-primary-foreground/85" : "text-muted-foreground")}>
                                            <span className={cn("font-semibold", !selected && count > 0 && "text-foreground")}>{countText}</span>
                                            <span className="max-sm:hidden">{count === 1 ? " call" : " calls"}</span>
                                        </span>
                                    )
                                : <Skeleton className="h-4 w-12" />}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
