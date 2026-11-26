import * as React from "react";
import { toast } from "sonner";

import type { FieldErrors } from "@/lib/alerts/alert-form";
import type { BulkExportFormState } from "@/lib/sec/bulk";

import { Section } from "@/components/ui/section";
import { ApiRequestError } from "@/lib/api/errors";
import { useApiMutation, useIdempotencyKey } from "@/lib/api/mutations";
import { BULK_QUERY_KEYS, useBulkExport, useBulkExportsInfinite } from "@/lib/api/queries";
import { bulkExportFieldErrorsOf, bulkRefusalText, emptyBulkExportForm, toCreateBulkExportBody } from "@/lib/sec/bulk";

import { BulkExportDetail, BulkExportForm, BulkExportsView } from "./bulk-exports-view";

/**
 * The Company exports tab (sec-bulk-downloads task 8): the form, the account's exports and the `?export=` detail.
 * "Create export" runs `createBulkExport` with ONE `Idempotency-Key` per submission (`useIdempotencyKey`: a double
 * click or a retry after a lost answer replays, never creates twice); a 400 puts its `param` / `errors[]` on the
 * fields, any other refusal toasts once (a 429 names the daily cap and its reset). A created export refreshes the list,
 * which then asks again every 5 s while an export is queued / running. Nothing is asked while `enabled` is false.
 */
export function BulkExportsTab({ enabled, onClose, onOpen, openExportId }: {
    enabled: boolean;
    onClose: () => void;
    onOpen: (exportId: string) => void;
    openExportId: string | undefined;
}) {
    const [state, setState] = React.useState<BulkExportFormState>(emptyBulkExportForm);

    const [errors, setErrors] = React.useState<FieldErrors>({});

    const create = useApiMutation("createBulkExport", { invalidates: [BULK_QUERY_KEYS.exports, BULK_QUERY_KEYS.export] });

    const idempotency = useIdempotencyKey();

    const exportList = useBulkExportsInfinite(enabled);

    const detail = useBulkExport(openExportId ?? "", enabled);

    const onSubmit = async () => {
        const { body, errors: local } = toCreateBulkExportBody(state);

        setErrors(local);

        if (Object.keys(local).length > 0) return;

        try {
            const created = await create.mutateAsync({ body, idempotencyKey: idempotency.keyFor(body) });

            idempotency.settle(null);

            toast.success(`Export ${created.export_id} is ${created.status}`, { description: "It appears in the list below; download it once it is ready." });
        }
        catch (error) {
            idempotency.settle(error);

            if (error instanceof ApiRequestError && error.status === 400) setErrors(bulkExportFieldErrorsOf(error));
            else toast.error("Export refused", { description: bulkRefusalText(error) });
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <Section description="One parsed data set filtered by companies and / or filers over an exact date range, as one file kept for 7 days." title="New export">
                <BulkExportForm
                    errors={errors}
                    isPending={create.isPending}
                    onChange={setState}
                    onSubmit={() => void onSubmit()}
                    state={state}
                />
            </Section>

            {openExportId && <BulkExportDetail error={detail.error} onClose={onClose} row={detail.data} />}

            <Section title="Your exports">
                <BulkExportsView
                    error={exportList.error}
                    hasNextPage={exportList.hasNextPage}
                    isFetchingNextPage={exportList.isFetchingNextPage}
                    isLoading={exportList.isLoading}
                    onLoadMore={() => void exportList.fetchNextPage()}
                    onOpen={onOpen}
                    pages={exportList.data?.pages ?? []}
                />
            </Section>
        </div>
    );
}
