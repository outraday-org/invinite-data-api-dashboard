import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import { ScriptsListView } from "@/components/alerts/script-list-view";
import { ScriptUploadDialog } from "@/components/alerts/script-upload-dialog";
import { TemplateListView } from "@/components/alerts/template-list";
import { TabStrip } from "@/components/navigation/tab-strip";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { listState } from "@/lib/api/list-state";
import { useAlertTemplates, useScriptsInfinite } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { IN_PLACE, optionalEnum } from "@/lib/url-state";

const scriptsSearchSchema = z.object({ tab: optionalEnum(["templates"]) });

export const Route = createFileRoute("/alerts/scripts/")({
    component: ScriptsPage,
    head: () => titleHead("Scripts"),
    validateSearch: scriptsSearchSchema,
});

function ScriptsTab() {
    const scripts = useScriptsInfinite();

    return (
        <ScriptsListView
            state={listState(scripts)}
        />
    );
}

function TemplatesTab() {
    const templates = useAlertTemplates(true);

    return <TemplateListView error={templates.error} isLoading={templates.isLoading} templates={templates.data?.data ?? []} />;
}

/**
 * Hosted scripts (`GET /v1/scripts`, oldest first) with "Upload script", and the built-in indicator templates
 * (`?tab=templates`, `GET /v1/alert-templates`).
 */
function ScriptsPage() {
    const { tab } = Route.useSearch();

    const navigate = useNavigate();

    const [uploading, setUploading] = React.useState(false);

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={(
                    <>
                        <TabStrip
                            aria-label="Scripts or templates"
                            onSelect={value => void navigate({ ...IN_PLACE, search: { tab: value === "templates" ? "templates" : undefined }, to: "/alerts/scripts" })}
                            options={[{ label: "Your scripts", value: "scripts" }, { label: "Built-in templates", value: "templates" }]}
                            value={tab ?? "scripts"}
                        />
                        {tab !== "templates" && <Button onClick={() => setUploading(true)} size="sm" type="button">Upload script</Button>}
                    </>
                )}
                description={tab === "templates"
                    ? "The built-in templates of indicator alerts: what each one alerts on, its inputs and defaults. Use one to start an indicator alert."
                    : "Your chartlang scripts for script alerts, oldest first. Name and description are fixed after upload; a new version replaces nothing (alerts keep theirs)."}
                title={tab === "templates" ? "Indicator templates" : "Scripts"}
            />
            {tab === "templates" ? <TemplatesTab /> : <ScriptsTab />}
            {uploading && (
                <ScriptUploadDialog
                    onOpenChange={setUploading}
                    onUploaded={(result) => {
                        if ("script" in result) void navigate({ params: { id: result.script.id }, to: "/alerts/scripts/$id" });
                    }}
                    open
                />
            )}
        </div>
    );
}
