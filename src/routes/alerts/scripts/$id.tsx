import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AlertsState } from "@/components/alerts/alert-parts";
import { ScriptDeleteConflict, ScriptVersionsList, ScriptVersionView } from "@/components/alerts/script-detail-view";
import { ScriptUploadDialog } from "@/components/alerts/script-upload-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { canAddVersion, SCRIPT_VERSIONS_MAX, versionsNewestFirst } from "@/lib/alerts/scripts";
import { ApiRequestError, errorDescription } from "@/lib/api/errors";
import { useApiMutation } from "@/lib/api/mutations";
import { SCRIPT_QUERY_KEYS, useScript, useScriptVersions } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { IN_PLACE, optionalInt } from "@/lib/url-state";

const scriptSearchSchema = z.object({ version: optionalInt(1, 1000) });

export const Route = createFileRoute("/alerts/scripts/$id")({
    component: ScriptPage,
    head: () => titleHead("Script"),
    validateSearch: scriptSearchSchema,
});

/**
 * One script (`GET /v1/scripts/{id}` + its versions): versions newest first (`?version=` picks one, else the newest),
 * the picked version's diagnostics beside its source, declared inputs, condition ids; "Upload new version" (the button
 * says when the 20-version limit is reached), "Create alert from this version" (compiled only), Delete (confirmed; a
 * 409 names the alerts that use it).
 */
function ScriptPage() {
    const { id } = Route.useParams();

    const { version: pickedVersion } = Route.useSearch();

    const navigate = Route.useNavigate();

    const script = useScript(id);

    const versions = useScriptVersions(id);

    const [uploading, setUploading] = React.useState(false);

    const [confirmDelete, setConfirmDelete] = React.useState(false);

    const [conflict, setConflict] = React.useState<null | string>(null);

    // The list only: the deleted script and its versions are not asked again (a 404 before the page navigates away).
    const remove = useApiMutation("deleteScript", { invalidates: [[...SCRIPT_QUERY_KEYS.scripts, "list"]] });

    const pick = (version: number | undefined) => void navigate({ ...IN_PLACE, search: { version } });

    const onDelete = async () => {
        setConflict(null);

        try {
            await remove.mutateAsync({ id });

            toast.success(`Deleted ${script.data?.name ?? id}`);

            void navigate({ to: "/alerts/scripts" });
        }
        catch (error) {
            if (error instanceof ApiRequestError && error.status === 409) setConflict(error.message);
            else toast.error(`Could not delete ${id}`, { description: errorDescription(error as Error) });
        }
        finally {
            setConfirmDelete(false);
        }
    };

    if (!script.data) {
        return (
            <div className="flex flex-col gap-4">
                <PageHeader title="Script" />
                {script.error ? <AlertsState error={script.error} notFound={`No script ${id} on this account.`} title="Failed to load the script" /> : <Skeleton className="h-64 w-full" />}
            </div>
        );
    }

    const loaded = script.data;

    const list = versionsNewestFirst(versions.data?.data ?? []);

    const selected = list.find(version => version.version === pickedVersion) ?? list.at(0) ?? null;

    const full = !canAddVersion(loaded);

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={(
                    <div className="flex flex-wrap items-center gap-2" data-testid="script-actions">
                        <Button disabled={full} onClick={() => setUploading(true)} size="sm" title={full ? `A script has at most ${SCRIPT_VERSIONS_MAX} versions` : undefined} type="button" variant="outline">
                            {full ? `${SCRIPT_VERSIONS_MAX} of ${SCRIPT_VERSIONS_MAX} versions — limit reached` : "Upload new version"}
                        </Button>
                        <Button disabled={remove.isPending} onClick={() => setConfirmDelete(true)} size="sm" type="button" variant="destructive">Delete…</Button>
                    </div>
                )}
                description={(
                    <span>
                        {loaded.description ?? "No description."}
                        {" · "}
                        <span className="font-mono">{loaded.id}</span>
                        {` · ${loaded.version_count} of ${SCRIPT_VERSIONS_MAX} versions · `}
                        <Link className="text-primary underline-offset-4 hover:underline" search={{ type: "script" }} to="/alerts">Script alerts</Link>
                    </span>
                )}
                title={loaded.name}
            />
            {conflict && <ScriptDeleteConflict detail={conflict} />}
            {versions.error && !versions.data
                ? <AlertsState error={versions.error} title="Failed to load the versions" />
                : versions.isLoading
                    ? <Skeleton className="h-40 w-full" />
                    : (
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                                <ScriptVersionsList onSelect={pick} selected={selected?.version ?? null} versions={list} />
                                {selected ? <ScriptVersionView scriptId={loaded.id} version={selected} /> : <p className="text-muted-foreground">No version stored.</p>}
                            </div>
                        )}
            {uploading && (
                <ScriptUploadDialog
                    onOpenChange={setUploading}
                    onUploaded={(result) => {
                        if (!("version" in result)) return;

                        // A new version may be the one the alerts named in a refused delete use: ask again on Delete.
                        setConflict(null);

                        pick(result.version.version);
                    }}
                    open
                    scriptId={loaded.id}
                />
            )}
            <ConfirmAction
                confirmLabel="Delete script"
                destructive
                effect={`Deletes the script and its ${loaded.version_count} version${loaded.version_count === 1 ? "" : "s"}. The API refuses while an alert uses one of them and names those alerts. This cannot be undone.`}
                ids={[loaded.id]}
                noun="script"
                onConfirm={() => void onDelete()}
                onOpenChange={setConfirmDelete}
                open={confirmDelete}
                pending={remove.isPending}
                title={`Delete ${loaded.name}?`}
            />
        </div>
    );
}
