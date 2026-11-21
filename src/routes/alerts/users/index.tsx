import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { AlertUserAction } from "@/components/alerts/alert-user-list-view";
import type { AlertUserFormState } from "@/lib/alerts/alert-users";
import type { AlertUser, AlertUserStatus } from "@/lib/api/types";

import { AlertUserDefaultsPanel } from "@/components/alerts/alert-user-defaults";
import { AlertUserDeleteResultNotice } from "@/components/alerts/alert-user-detail-view";
import { AlertUserBatchDialog, AlertUserEditDialog } from "@/components/alerts/alert-user-dialogs";
import { AlertUsersListView } from "@/components/alerts/alert-user-list-view";
import { useAlertUserActions } from "@/components/alerts/use-alert-user-actions";
import { DebouncedInput } from "@/components/navigation/debounced-input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ALERT_USER_STATUS_INFO, ALERT_USER_STATUSES, emptyAlertUserForm, fromAlertUser } from "@/lib/alerts/alert-users";
import { useAlertUserDefaults, useAlertUsersInfinite } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { IN_PLACE, optionalEnum, optionalText } from "@/lib/url-state";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

/** The list's filters as the API names them (`q` = an id prefix). */
const alertUsersSearchSchema = z.object({
    q: optionalText(200),
    status: optionalEnum(ALERT_USER_STATUSES),
});

type AlertUsersSearch = z.infer<typeof alertUsersSearchSchema>;

export const Route = createFileRoute("/alerts/users/")({
    component: AlertUsersPage,
    head: () => titleHead("End users"),
    validateSearch: alertUsersSearchSchema,
});

const ALL = "all";

const STATUS_OPTIONS: Array<{ label: string; value: AlertUserStatus | typeof ALL }> = [
    { label: "Every status", value: ALL },
    ...ALERT_USER_STATUSES.map(status => ({ label: ALERT_USER_STATUS_INFO[status].label, value: status })),
];

type EditState = null | { initial: AlertUserFormState; key: string; mode: "create" | "edit" };

/**
 * The account's end users (`GET /v1/alert-users`): status and id-prefix filters in the URL and on the server, usage
 * against the effective limits, pause / resume / delete (confirmed), add / edit (an upsert), bulk upsert from a paste,
 * and the account's end-user defaults (`#defaults`).
 */
function AlertUsersPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<AlertUsersSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const users = useAlertUsersInfinite({ q: search.q, status: search.status });

    const defaults = useAlertUserDefaults();

    const actions = useAlertUserActions();

    const [edit, setEdit] = React.useState<EditState>(null);

    const [batchOpen, setBatchOpen] = React.useState(false);

    const onAction = (action: AlertUserAction, user: AlertUser) => {
        if (action === "edit") setEdit({ initial: fromAlertUser(user), key: `edit:${user.external_user_id}:${user.updated_at}`, mode: "edit" });
        else actions.request(action, user);
    };

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={(
                    <>
                        <Button onClick={() => setEdit({ initial: emptyAlertUserForm(), key: `create:${Date.now()}`, mode: "create" })} size="sm" type="button">Add end user</Button>
                        <Button onClick={() => setBatchOpen(true)} size="sm" type="button" variant="outline">Bulk upsert</Button>
                    </>
                )}
                description="Your customers' ids on alerts (external_user_id), ordered by id, each with its usage against its effective limits. Limits left empty follow the end-user defaults below."
                title="End users"
            />
            <div className="flex flex-wrap items-center gap-2">
                <FilterSelect aria-label="Status" className="w-[150px]" onValueChange={value => onChange({ status: value === ALL ? undefined : value })} options={STATUS_OPTIONS} value={search.status ?? ALL} />
                <DebouncedInput aria-label="End user id starts with" className="w-[220px]" onCommit={q => onChange({ q: q || undefined })} placeholder="Id starts with…" value={search.q ?? ""} />
            </div>
            {actions.deleted && <AlertUserDeleteResultNotice onDismiss={actions.dismissDeleted} outcome={actions.deleted} />}
            <AlertUsersListView
                busy={actions.busy}
                onAction={onAction}
                state={{
                    error: users.error,
                    hasNextPage: users.hasNextPage,
                    isFetchingNextPage: users.isFetchingNextPage,
                    isLoading: users.isLoading,
                    onLoadMore: () => void users.fetchNextPage(),
                    pages: users.data?.pages ?? [],
                }}
            />
            <AlertUserDefaultsPanel />
            {edit && (
                <AlertUserEditDialog
                    defaults={defaults.data}
                    initial={edit.initial}
                    key={edit.key}
                    mode={edit.mode}
                    onOpenChange={open => !open && setEdit(null)}
                    open
                />
            )}
            {batchOpen && <AlertUserBatchDialog onOpenChange={setBatchOpen} open />}
            {actions.dialog}
        </div>
    );
}
