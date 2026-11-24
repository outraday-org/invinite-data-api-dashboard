import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import type { AlertType } from "@/lib/api/types";

import { CreateAlertForm } from "@/components/alerts/alert-editor";
import { AlertsState } from "@/components/alerts/alert-parts";
import { MacroAvailability } from "@/components/macro/macro-availability";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { fromAlert, prefilledForm } from "@/lib/alerts/alert-form";
import { ALERT_TYPES } from "@/lib/alerts/labels";
import { useAlert } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { optionalEnum, optionalText } from "@/lib/url-state";

/**
 * `?type=&symbol=` pre-fill the form (the "Create alert" entry points of ticker pages, task A4); `?from=<alert id>` =
 * "Duplicate" (the stored alert without its client reference id, which is unique per account); `?script=<scr id>
 * &version=<scv id>` = "Create alert from this version" (a `script` alert of that version), `?template=<key>` = "Use
 * template" (an `indicator` alert of that built-in template).
 */
const newAlertSearchSchema = z.object({
    from: optionalText(64),
    script: optionalText(64),
    series: optionalText(100),
    symbol: optionalText(64),
    template: optionalText(100),
    type: optionalEnum(ALERT_TYPES as [AlertType, ...Array<AlertType>]),
    version: optionalText(64),
});

export type NewAlertSearch = z.infer<typeof newAlertSearchSchema>;

export const Route = createFileRoute("/alerts/new")({
    component: NewAlertPage,
    head: () => titleHead("New alert"),
    validateSearch: newAlertSearchSchema,
});

/** The header's description of a pre-filled form (pure). */
export function newAlertDescription(search: NewAlertSearch) {
    if (search.from) return `A copy of ${search.from}; nothing is saved until you create it.`;

    if (search.version) return `A script alert of version ${search.version}${search.script ? ` (script ${search.script})` : ""}: add the symbol and interval, then create it.`;

    if (search.template) return `An indicator alert of the built-in template ${search.template}: add the symbol and interval, then create it.`;

    return "Pick a type, then what it watches, when it fires and where it is delivered. Check asks the API without creating anything.";
}

function NewAlertPage() {
    const search = Route.useSearch();

    const source = useAlert(search.from ?? "");

    const header = (
        <PageHeader
            actions={search.script ? <Link className="text-primary underline-offset-4 hover:underline" params={{ id: search.script }} to="/alerts/scripts/$id">Back to the script</Link> : undefined}
            description={newAlertDescription(search)}
            title={search.from ? "Duplicate alert" : "New alert"}
        />
    );

    if (search.from && !source.data) {
        return (
            <div className="flex flex-col gap-4">
                {header}
                {source.error ? <AlertsState error={source.error} notFound={`No alert ${search.from} on this account.`} title="Failed to load the alert to copy" /> : <Skeleton className="h-64 w-full" />}
            </div>
        );
    }

    const initial = source.data ? fromAlert(source.data, { duplicate: true }) : prefilledForm(search.type, search.symbol, { series: search.series, template: search.template, version: search.version });

    const form = <CreateAlertForm initial={initial} initialScriptId={search.script} key={search.from ?? [search.type, search.symbol, search.series, search.version, search.template].map(part => part ?? "").join(":")} />;

    return (
        <div className="flex flex-col gap-4">
            {header}
            {initial.type === "macro" ? <MacroAvailability>{form}</MacroAvailability> : form}
        </div>
    );
}
