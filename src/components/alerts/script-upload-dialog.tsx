import * as React from "react";
import { toast } from "sonner";

import type { Script, ScriptVersion } from "@/lib/api/types";

import { FieldShell } from "@/components/alerts/alert-form-view";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { problemFieldErrors } from "@/lib/alerts/alert-form";
import { SCRIPT_DESCRIPTION_MAX, SCRIPT_NAME_MAX, SCRIPT_SOURCE_MAX, scriptUploadErrors } from "@/lib/alerts/scripts";
import { ApiRequestError, errorDescription } from "@/lib/api/errors";
import { useApiMutation } from "@/lib/api/mutations";
import { SCRIPT_QUERY_KEYS } from "@/lib/api/queries";
import { formatNumber } from "@/lib/format";

export type ScriptUploadState = { description: string; name: string; source: string };

const fieldId = (key: string) => `script-field-${key}`;

/**
 * The upload fields (pure): name and description only for a new script (fixed after upload: there is no update
 * operation), the source as text or from a file, with its size against the 204 800-character limit. The source box
 * grows with its text up to half the window, then scrolls itself, so Upload stays in reach of a long source.
 */
export function ScriptUploadFields({ errors, kind, onChange, onFile, state }: { errors: Record<string, string>; kind: "script" | "version"; onChange: (state: ScriptUploadState) => void; onFile: (input: HTMLInputElement) => void; state: ScriptUploadState }) {
    const over = state.source.length > SCRIPT_SOURCE_MAX;

    return (
        <div className="flex flex-col gap-3">
            {kind === "script" && (
                <>
                    <FieldShell error={errors.name} help={`At most ${SCRIPT_NAME_MAX} characters; fixed after upload.`} htmlFor={fieldId("name")} label="Name">
                        <Input id={fieldId("name")} onChange={event => onChange({ ...state, name: event.target.value })} value={state.name} />
                    </FieldShell>
                    <FieldShell error={errors.description} help={`Optional, at most ${SCRIPT_DESCRIPTION_MAX} characters; fixed after upload.`} htmlFor={fieldId("description")} label="Description">
                        <Input id={fieldId("description")} onChange={event => onChange({ ...state, description: event.target.value })} value={state.description} />
                    </FieldShell>
                </>
            )}
            <FieldShell
                error={errors.source}
                help={(
                    <span className={over ? "text-destructive" : undefined} data-testid="source-size">
                        {`${formatNumber(state.source.length)} of ${formatNumber(SCRIPT_SOURCE_MAX)} characters. chartlang (TypeScript); the only import allowed is @invinite-org/chartlang-core. Compiled on upload (≤ 10 s).`}
                    </span>
                )}
                htmlFor={fieldId("source")}
                label="Source"
            >
                <Textarea className="max-h-[50vh] min-h-48 overflow-y-auto font-mono" id={fieldId("source")} onChange={event => onChange({ ...state, source: event.target.value })} spellCheck={false} value={state.source} />
                <label className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">Or read a file:</span>
                    <input accept=".ts,.js,.txt,text/plain,text/typescript,application/typescript" aria-label="Read the source from a file" className="text-xs" onChange={event => onFile(event.target)} type="file" />
                </label>
            </FieldShell>
        </div>
    );
}

const UPLOAD_FIELDS = new Set(["description", "name", "source"]);

/** A refused upload on its fields (a problem's `param` / `errors[]`: name / description / source), else one line. */
function uploadErrorsOf(error: unknown): Record<string, string> {
    if (error instanceof ApiRequestError && error.status === 429) return { form: `Another upload of this account is compiling; try again in a few seconds. (${errorDescription(error)})` };

    if (!(error instanceof ApiRequestError) || error.status !== 400) return { form: errorDescription(error as Error) };

    return problemFieldErrors(error, (param) => {
        const field = param?.split(".")[0];

        return field && UPLOAD_FIELDS.has(field) ? field : null;
    });
}

/**
 * "Upload script" (`POST /v1/scripts`) or "Upload new version" (`POST /v1/scripts/{id}/versions`): a source above the
 * limit is refused before anything is sent; a compile error is still an upload (its version has diagnostics).
 */
export function ScriptUploadDialog({ onOpenChange, onUploaded, open, scriptId }: { onOpenChange: (open: boolean) => void; onUploaded: (result: { script: Script } | { version: ScriptVersion }) => void; open: boolean; scriptId?: string }) {
    const kind = scriptId ? "version" : "script";

    const [state, setState] = React.useState<ScriptUploadState>({ description: "", name: "", source: "" });

    const [errors, setErrors] = React.useState<Record<string, string>>({});

    const createScript = useApiMutation("createScript", { invalidates: [SCRIPT_QUERY_KEYS.scripts] });

    const createVersion = useApiMutation("createScriptVersion", { invalidates: [SCRIPT_QUERY_KEYS.scripts] });

    const pending = createScript.isPending || createVersion.isPending;

    const onFile = async (input: HTMLInputElement) => {
        const file = input.files?.[0];

        // Picking the same file again reads it again.
        input.value = "";

        if (!file) return;

        try {
            const source = await file.text();

            setState(current => ({ ...current, name: current.name || file.name.replace(/\.[^.]+$/, ""), source }));
        }
        catch {
            setErrors(current => ({ ...current, source: `${file.name} could not be read.` }));
        }
    };

    const onSubmit = async () => {
        const local = scriptUploadErrors(state, { needsName: kind === "script" });

        setErrors(local);

        if (Object.keys(local).length > 0) return;

        try {
            if (scriptId) {
                const version = await createVersion.mutateAsync({ id: scriptId, source: state.source });

                toast.success(version.status === "ok" ? `Version ${version.version} compiled` : `Version ${version.version} uploaded with compile errors`);

                onUploaded({ version });
            }
            else {
                const script = await createScript.mutateAsync({ description: state.description.trim() || undefined, name: state.name.trim(), source: state.source });

                toast.success(script.latest_version?.status === "error" ? `${script.name} uploaded with compile errors` : `${script.name} compiled`);

                onUploaded({ script });
            }

            onOpenChange(false);
        }
        catch (error) {
            setErrors(uploadErrorsOf(error));
        }
    };

    return (
        <Dialog onOpenChange={next => !pending && onOpenChange(next)} open={open}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <form
                    className="flex flex-col gap-4"
                    noValidate
                    onSubmit={(event) => {
                        event.preventDefault();

                        if (!pending) void onSubmit();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>{kind === "script" ? "Upload script" : "Upload new version"}</DialogTitle>
                        <DialogDescription>
                            {kind === "script"
                                ? "Creates the script and its version 1. A compile error still uploads it: the version shows its diagnostics."
                                : "Adds the next version (at most 20 per script). Existing alerts keep their version."}
                        </DialogDescription>
                    </DialogHeader>
                    <ScriptUploadFields errors={errors} kind={kind} onChange={setState} onFile={input => void onFile(input)} state={state} />
                    {errors.form && <p className="text-destructive" role="alert">{errors.form}</p>}
                    <DialogFooter>
                        <Button disabled={pending} onClick={() => onOpenChange(false)} type="button" variant="ghost">Cancel</Button>
                        <Button disabled={pending} type="submit">{pending ? "Compiling…" : "Upload"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
