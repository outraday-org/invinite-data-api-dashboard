import { Notice } from "@/components/ui/notice";
import { dataApiDashboardUrl } from "@/lib/app-url";

/**
 * The plan notice of `/sec/datasets` (sec-bulk-downloads task 8): every operation of the page is Enterprise, so a key
 * whose plan lacks it sees this one notice per tab and the page sends no request.
 */
export function BulkPlanNotice({ title = "Bulk downloads are part of the Enterprise plan" }: { title?: string }) {
    return (
        <Notice badge="Enterprise" title={title}>
            The SEC bulk files, company exports and data set releases are served to Enterprise keys.
            {" "}
            <a className="text-primary hover:underline" href={dataApiDashboardUrl("billing")} rel="noreferrer" target="_blank">
                Plans and billing in the Invinite Data app
            </a>
            .
        </Notice>
    );
}
