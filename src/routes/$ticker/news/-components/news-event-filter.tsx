import { CalendarSearch } from "lucide-react";
import * as React from "react";

import type { V2Event } from "@/lib/api/types";

import { Button } from "@/components/ui/button";
import { useV2EventsInfinite } from "@/lib/api/queries";
import { eventLabel } from "@/lib/earnings/format";
import { formatDay } from "@/lib/format";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

/** Events offered (the newest first: calls, investor days …); an older one comes by link (`?event=`). */
const EVENT_CHOICES = 20;

const ALL = "all";

/** "Q3 FY2026 · Oct 30, 2026" — the picker's line of one event. */
export function eventChoiceLabel(event: Pick<V2Event, "event_title" | "event_type" | "fiscal_quarter" | "fiscal_year" | "scheduled_at">) {
    return `${eventLabel(event)} · ${formatDay(event.scheduled_at)}`;
}

/** The picker's options: every event, plus the selected one when the loaded list does not name it. */
export function eventChoices(events: ReadonlyArray<V2Event>, selected: string | undefined) {
    const options = [{ label: "All news", value: ALL }, ...events.map(event => ({ label: eventChoiceLabel(event), value: event.event_id }))];

    return selected && !events.some(event => event.event_id === selected) ? [...options, { label: "Selected event", value: selected }] : options;
}

/**
 * "News of one call" (`/v1/news?event=`): the company's events are asked only once the reader opens the filter (or a
 * link already carries `?event=`), never on page load.
 */
export function NewsEventFilter({ event, onChange, ticker }: { event: string | undefined; onChange: (event: string | undefined) => void; ticker: string }) {
    const [armed, setArmed] = React.useState(false);

    const enabled = armed || event !== undefined;

    const events = useV2EventsInfinite({ company: ticker, enabled, limit: EVENT_CHOICES, sort: "-scheduled_at", toastErrors: false, type: "all" });

    if (!enabled) {
        return (
            <Button onClick={() => setArmed(true)} size="lg" type="button" variant="outline">
                <CalendarSearch />
                Filter by call
            </Button>
        );
    }

    const loaded = events.data?.pages.flatMap(page => page.data) ?? [];

    return (
        <FilterSelect
            aria-label="Call or event"
            className="w-[220px]"
            disabled={events.isLoading}
            onValueChange={value => onChange(value === ALL ? undefined : value)}
            options={events.isLoading ? [{ label: "Loading events…", value: event ?? ALL }] : eventChoices(loaded, event)}
            title={events.error ? "The events could not be loaded" : undefined}
            value={event ?? ALL}
        />
    );
}
