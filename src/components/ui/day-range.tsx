import { Input } from "./input";

/** One end of a `DayRange` changed: the new day, or undefined when cleared. */
export type DayRangePatch = { from: string | undefined } | { to: string | undefined };

/**
 * THE from / to day-input pair of a filter row: two 150 px date inputs named by `labels` (their accessible names), the
 * `separator` between them ("to"; the holidays page says "and"), an optional muted `lead` ("Filed", "Ex-date",
 * "Between"). `onChange` gets the changed end only, a cleared input as undefined. Without `group` the pieces join the
 * caller's flex row; with `group` they wrap as one unit (a filter row with several ranges: offerings, insider trades).
 * `titled` repeats each label as the input's tooltip (insider trades: two ranges side by side).
 */
export function DayRange({
    from,
    group = false,
    labels,
    lead,
    onChange,
    separator = "to",
    separatorClassName = "text-muted-foreground",
    titled = false,
    to,
}: {
    from: string | undefined;
    group?: boolean;
    labels: { from: string; to: string };
    lead?: string;
    onChange: (patch: DayRangePatch) => void;
    separator?: string;
    /** The calendar and news rows set the separator in `text-xs` (their own size), as before. */
    separatorClassName?: string;
    titled?: boolean;
    to: string | undefined;
}) {
    const pieces = (
        <>
            {lead !== undefined && <span className="text-muted-foreground">{lead}</span>}
            <Input
                aria-label={labels.from}
                className="w-[150px]"
                onChange={event => onChange({ from: event.target.value || undefined })}
                title={titled ? labels.from : undefined}
                type="date"
                value={from ?? ""}
            />
            <span className={separatorClassName}>{separator}</span>
            <Input
                aria-label={labels.to}
                className="w-[150px]"
                onChange={event => onChange({ to: event.target.value || undefined })}
                title={titled ? labels.to : undefined}
                type="date"
                value={to ?? ""}
            />
        </>
    );

    return group ? <span className="flex flex-wrap items-center gap-2">{pieces}</span> : pieces;
}
