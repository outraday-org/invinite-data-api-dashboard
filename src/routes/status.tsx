import { createFileRoute } from "@tanstack/react-router";

import type { StatusWindow } from "@/lib/status/search";

import { StatusPageView } from "@/components/status/status-page-view";
import { useApiStatus, useEarningsCallsStatus } from "@/lib/api/queries";
import { PUBLIC_PAGE_HEADERS } from "@/lib/public-page";
import { ALL_VENDORS, validateStatusSearch } from "@/lib/status/search";

export const Route = createFileRoute("/status")({
    component: StatusPage,
    head: () => ({ meta: [{ title: "API status · Invinite API" }] }),
    // The CDN caches this shell; the data comes through the memoised, key-less server functions.
    headers: () => PUBLIC_PAGE_HEADERS,
    validateSearch: validateStatusSearch,
});

function StatusPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const vendor = search.vendor ?? ALL_VENDORS;

    const status = useApiStatus(search.days);

    const earnings = useEarningsCallsStatus({ days: search.days, vendor });

    const setDays = (days: StatusWindow) => {
        void navigate({ replace: true, search: previous => ({ ...previous, days }) });
    };

    const setVendor = (next: string) => {
        void navigate({ replace: true, search: previous => ({ ...previous, vendor: next === ALL_VENDORS ? undefined : next }) });
    };

    return (
        <StatusPageView
            days={search.days}
            earnings={earnings}
            onDaysChange={setDays}
            onVendorChange={setVendor}
            status={status}
            vendor={vendor}
        />
    );
}
