import * as React from "react";

import type { AlertFormState } from "@/lib/alerts/alert-form";
import type { DeclaredInput } from "@/lib/alerts/scripts";
import type { Destination, JsonValue, Script, ScriptVersion } from "@/lib/api/types";

import { DestinationEditorDialog } from "@/components/alerts/destination-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input } from "@/components/ui/input";
import { kindLabel, presetLabel } from "@/lib/alerts/destinations";
import { defaultText, inputRangeText, manifestInputs, versionsNewestFirst } from "@/lib/alerts/scripts";
import { useDestinationsInfinite, useScriptsInfinite, useScriptVersions } from "@/lib/api/queries";
import { isRecord } from "@/lib/guards";

/**
 * The alert form's pickers (backend tasks/data-api-dashboard 2-alerts task 4; the second lane to hand over owns them):
 * destinations (`listDestinations`), the script version of a `script` alert (`listScripts` → `listScriptVersions`) and
 * the version's declared inputs as fields. The form state stays text (`destinationIds`, `condition.script_version_id`,
 * `condition.inputs` JSON): the pickers only write it, so `toCreateBody` / `fromAlert` are unchanged.
 */

/** At most 10 destinations per alert (`destination_ids` `maxItems`). */
export const DESTINATIONS_MAX = 10;

/** The ids of the form's destination text (one per line, comma or space; pure). */
export function destinationIdsOf(text: string): Array<string> {
    return text.split(/[\s,]+/).map(id => id.trim()).filter(Boolean);
}

export type DestinationOptions = { data: ReadonlyArray<Destination>; error: unknown; isLoading: boolean; onNew?: () => void };

/** The account's destinations for the picker (every page: at most a few hundred, 200 a page). */
export function useDestinationOptions(): Omit<DestinationOptions, "onNew"> {
    const query = useDestinationsInfinite();

    const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

    React.useEffect(() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    return { data: query.data?.pages.flatMap(page => page.data) ?? [], error: query.error, isLoading: query.isLoading };
}

/**
 * The destinations of an alert (pure): one checkbox per destination (its URL and description, kind / preset; a disabled
 * one can be picked and says so), at most 10; an id the account does not list (typed, or deleted since) stays as a chip
 * until removed; "New destination" creates one inline. None picked = the event feed and the live stream only.
 */
export function DestinationPicker({ onChange, options, value }: { onChange: (text: string) => void; options: DestinationOptions; value: string }) {
    const picked = destinationIdsOf(value);

    const known = new Set(options.data.map(destination => destination.id));

    const unknown = picked.filter(id => !known.has(id));

    const full = picked.length >= DESTINATIONS_MAX;

    const toggle = (id: string, on: boolean) => onChange((on ? [...picked, id] : picked.filter(item => item !== id)).join("\n"));

    return (
        <div className="flex flex-col gap-2" data-testid="destination-picker">
            {options.isLoading && <p className="text-muted-foreground">Loading destinations…</p>}
            {Boolean(options.error) && <p className="text-destructive">The destinations could not be loaded; the ids below stay as they are.</p>}
            {!options.isLoading && !options.error && options.data.length === 0 && <p className="text-muted-foreground">The account has no destination yet.</p>}
            {options.data.length > 0 && (
                <ul aria-label="Destinations" className="flex flex-col divide-y rounded-md border" role="group">
                    {options.data.map((destination) => {
                        const checked = picked.includes(destination.id);

                        return (
                            <li key={destination.id}>
                                <div className="flex min-w-0 items-start gap-2 px-3 py-2">
                                    <input
                                        checked={checked}
                                        className="mt-0.5 size-3.5 shrink-0 accent-primary"
                                        disabled={!checked && full}
                                        id={`destination-pick-${destination.id}`}
                                        onChange={event => toggle(destination.id, event.target.checked)}
                                        type="checkbox"
                                    />
                                    <span className="flex min-w-0 flex-col">
                                        <label className="truncate font-medium" htmlFor={`destination-pick-${destination.id}`}>{destination.description ?? destination.url}</label>
                                        <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                                            <span className="truncate font-mono">{destination.id}</span>
                                            <span>{`· ${kindLabel(destination.kind)} · ${presetLabel(destination.preset)}`}</span>
                                            {destination.description && <span className="truncate">{`· ${destination.url}`}</span>}
                                            {destination.status === "disabled" && <Badge variant="destructive">Disabled: deliveries stop until re-enabled</Badge>}
                                        </span>
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            {unknown.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                    <span className="text-muted-foreground">Not listed on this account:</span>
                    {unknown.map(id => (
                        <Badge className="gap-1 font-mono" key={id} variant="outline">
                            {id}
                            <button aria-label={`Remove ${id}`} className="ml-1" onClick={() => toggle(id, false)} type="button">×</button>
                        </Badge>
                    ))}
                </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
                {options.onNew && <Button disabled={full} onClick={options.onNew} size="sm" type="button" variant="outline">New destination…</Button>}
                <span className="text-xs text-muted-foreground">{`${picked.length} of ${DESTINATIONS_MAX} picked.`}</span>
            </div>
        </div>
    );
}

export type ScriptOptions = {
    error: unknown;
    isLoading: boolean;
    onScript: (scriptId: string) => void;
    scriptId: string;
    scripts: ReadonlyArray<Script>;
    /** The picked script's versions, newest first. */
    versions: ReadonlyArray<ScriptVersion>;
};

/**
 * The script picker's data: the account's scripts and the picked one's versions; idle unless the form is a `script`
 * alert. The script is the one of `?script=`, else the one whose latest version the form holds, else none yet.
 */
export function useScriptOptions(enabled: boolean, versionId: string, initialScriptId = ""): ScriptOptions {
    const scripts = useScriptsInfinite(enabled);

    const [chosen, setChosen] = React.useState(initialScriptId);

    const all = scripts.data?.pages.flatMap(page => page.data) ?? [];

    const scriptId = chosen || (all.find(script => script.latest_version?.id === versionId)?.id ?? "");

    const versions = useScriptVersions(enabled ? scriptId : "");

    return {
        error: scripts.error ?? versions.error,
        isLoading: scripts.isLoading || versions.isLoading,
        onScript: setChosen,
        scriptId,
        scripts: all,
        versions: versionsNewestFirst(versions.data?.data ?? []),
    };
}

const UNSET = "__unset";

/**
 * The script version of a `script` alert (pure): a script, then one of its compiled versions (a version with compile
 * errors cannot run and is not offered). A version id the lists do not show (an alert's older version, a typed id) is
 * kept and named.
 */
export function ScriptVersionPicker({ id, onChange, options, required, value }: { required?: boolean; id: string; onChange: (versionId: string) => void; options: ScriptOptions; value: string }) {
    const usable = options.versions.filter(version => version.status === "ok");

    const listed = options.versions.some(version => version.id === value);

    const script = options.scripts.find(item => item.id === options.scriptId);

    return (
        <div className="flex flex-col gap-2" data-testid="script-version-picker">
            <DropdownSelect
                aria-label="Script"
                aria-required={required}
                className="w-full"
                id={`${id}-script`}
                label={script ? script.name : options.isLoading ? "Loading scripts…" : options.scripts.length === 0 ? "No script uploaded yet" : "Pick a script"}
                onValueChange={(next) => {
                    options.onScript(next === UNSET ? "" : next);

                    onChange("");
                }}
                options={[{ label: "Pick a script", value: UNSET }, ...options.scripts.map(item => ({ label: item.name, value: item.id }))]}
                value={options.scriptId || UNSET}
            />
            {options.scriptId && (
                <DropdownSelect
                    aria-label="Script version"
                    aria-required={required}
                    className="w-full"
                    id={id}
                    label={listed ? `Version ${options.versions.find(version => version.id === value)?.version}` : value ? value : usable.length === 0 && !options.isLoading ? "No compiled version" : "Pick a version"}
                    onValueChange={next => onChange(next === UNSET ? "" : next)}
                    options={[{ label: "Pick a version", value: UNSET }, ...usable.map(version => ({ label: `Version ${version.version} · ${version.id}`, value: version.id }))]}
                    value={value || UNSET}
                />
            )}
            {value && !listed && <p className="text-muted-foreground">{`Version ${value} is kept: it is not among the compiled versions of the picked script.`}</p>}
            {Boolean(options.error) && <p className="text-destructive">The scripts could not be loaded; the version id stays as it is.</p>}
        </div>
    );
}

/** The declared inputs of the picked version (none = no picker data or no manifest). */
export function declaredInputsOf(options: ScriptOptions | undefined, versionId: string): Array<DeclaredInput> {
    const version = options?.versions.find(item => item.id === versionId);

    return version ? manifestInputs(version.manifest) : [];
}

/** The `inputs` JSON text as an object (anything else = empty; pure). */
export function inputsObjectOf(text: string): Record<string, JsonValue> {
    try {
        const parsed: unknown = JSON.parse(text);

        return isRecord<JsonValue>(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
}

/**
 * One declared input's text written into the `inputs` JSON (pure): "" removes it (the default applies); a number kind
 * that reads as a number is stored as one, a bool as true / false, anything else as typed (the API checks it).
 */
export function withInput(text: string, input: Pick<DeclaredInput, "kind" | "name">, raw: string): string {
    const next = { ...inputsObjectOf(text) };

    const trimmed = raw.trim();

    if (trimmed === "") delete next[input.name];
    else if ((input.kind === "int" || input.kind === "float" || input.kind === "price" || input.kind === "time") && Number.isFinite(Number(trimmed))) next[input.name] = Number(trimmed);
    else if (input.kind === "bool" && (trimmed === "true" || trimmed === "false")) next[input.name] = trimmed === "true";
    else next[input.name] = trimmed;

    return Object.keys(next).length > 0 ? JSON.stringify(next, null, 2) : "";
}

/** The picked version's declared inputs as fields (pure): each writes its value into the `inputs` JSON; empty = default. */
export function ScriptInputsFields({ inputs, onChange, text }: { inputs: ReadonlyArray<DeclaredInput>; onChange: (text: string) => void; text: string }) {
    const values = inputsObjectOf(text);

    return (
        <div className="col-span-full grid gap-4 md:grid-cols-2" data-testid="script-input-fields">
            {inputs.map((input) => {
                const fieldId = `alert-field-condition-inputs-${input.name}`;

                const value = values[input.name];

                const range = inputRangeText(input);

                return (
                    <div className="flex min-w-0 flex-col gap-1" key={input.name}>
                        <label className="text-sm font-medium" htmlFor={fieldId}>{input.title}</label>
                        <Input
                            id={fieldId}
                            onChange={event => onChange(withInput(text, input, event.target.value))}
                            placeholder={defaultText(input.default)}
                            value={!Object.hasOwn(values, input.name) ? "" : typeof value === "string" ? value : JSON.stringify(value)}
                        />
                        <p className="text-xs text-muted-foreground">{`${input.kind}${range ? ` · ${range}` : ""} · default ${defaultText(input.default)} (empty = the default)`}</p>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * The pickers of one alert form (create and edit share it): the destinations (every page) with "New destination"
 * creating one inline (`DestinationEditorDialog`: its secret shown once, then the new id is picked), and — for a
 * `script` alert only — the scripts and the picked one's versions.
 */
export function useAlertFormPickers(state: AlertFormState, setState: React.Dispatch<React.SetStateAction<AlertFormState>>, initialScriptId?: string) {
    const destinations = useDestinationOptions();

    const [creating, setCreating] = React.useState(false);

    const isScript = state.type === "script";

    const versionId = typeof state.condition.script_version_id === "string" ? state.condition.script_version_id : "";

    const scripts = useScriptOptions(isScript, versionId, initialScriptId);

    const dialog = creating
        ? (
                <DestinationEditorDialog
                    destination={null}
                    onClose={() => setCreating(false)}
                    onCreated={destination => setState(current => ({ ...current, destinationIds: [...destinationIdsOf(current.destinationIds), destination.id].join("\n") }))}
                />
            )
        : null;

    return {
        destinationOptions: { ...destinations, onNew: () => setCreating(true) },
        dialog,
        scriptOptions: isScript ? scripts : undefined,
    };
}
