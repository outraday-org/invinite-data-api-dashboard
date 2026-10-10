import { createFileRoute } from "@tanstack/react-router";

import { LicensingPageView } from "@/components/licensing/licensing-page-view";
import { useLicensing } from "@/lib/api/queries";
import { PUBLIC_PAGE_HEADERS } from "@/lib/public-page";

export const Route = createFileRoute("/licensing")({
    component: LicensingPage,
    head: () => ({ meta: [{ title: "Licensing · Invinite API" }] }),
    // The CDN caches this shell; the data comes through the memoised, key-less server functions.
    headers: () => PUBLIC_PAGE_HEADERS,
});

function LicensingPage() {
    const { data, error, isLoading } = useLicensing();

    return <LicensingPageView data={data} error={error} isLoading={isLoading} />;
}
