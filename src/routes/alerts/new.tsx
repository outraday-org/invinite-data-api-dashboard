import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import type { AlertType } from "@/lib/api/types";

import { CreateAlertForm } from "@/components/alerts/alert-editor";
import { AlertsState } from "@/components/alerts/alert-parts";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { fromAlert, prefilledForm } from "@/lib/alerts/alert-form";
import { ALERT_TYPES } from "@/lib/alerts/labels";
import { useAlert } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { optionalEnum, optionalText } from "@/lib/url-state";

/**
 * `?type=&symbol=` pre-fill the form (the "Create alert" entry points of ticker pages, task A4); `?from=<alert id>` =
 * "Duplicate" (the stored alert without its client reference id, which is unique per account).
 */
const newAlertSearchSchema = z.object({
    from: optionalText(64),
    symbol: optionalText(64),
    type: optionalEnum(ALERT_TYPES as [AlertType, ...Array<AlertType>]),
});

export const Route = createFileRoute("/alerts/new")({
    component: NewAlertPage,
    head: () => titleHead("New alert"),
    validateSearch: newAlertSearchSchema,
});

function NewAlertPage() {
    const search = Route.useSearch();

    const source = useAlert(search.from ?? "");

    const header = (
        <PageHeader
            description={search.from ? `A copy of ${search.from}; nothing is saved until you create it.` : "Pick a type, then what it watches, when it fires and where it is delivered. Check asks the API without creating anything."}
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

    const initial = source.data ? fromAlert(source.data, { duplicate: true }) : prefilledForm(search.type, search.symbol);

    return (
        <div className="flex flex-col gap-4">
            {header}
            <CreateAlertForm initial={initial} key={search.from ?? `${search.type ?? ""}:${search.symbol ?? ""}`} />
        </div>
    );
}
