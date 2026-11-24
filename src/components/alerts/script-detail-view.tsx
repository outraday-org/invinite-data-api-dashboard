import { Link } from "@tanstack/react-router";

import type { ScriptDiagnostic, ScriptVersion } from "@/lib/api/types";

import { DetailRow } from "@/components/alerts/alert-parts";
import { ScriptVersionStatusBadge } from "@/components/alerts/script-list-view";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";
import { Stat, StatGrid } from "@/components/ui/stat";
import { alertIdsInDetail, defaultText, diagnosticsByLine, diagnosticsSummary, inputRangeText, manifestInputs } from "@/lib/alerts/scripts";
import { formatInstant } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The id of a source line's element (the diagnostics link to it). */
export const sourceLineId = (line: number) => `script-L${line}`;

/** The versions, newest first (pure): number, status, diagnostics, upload time; the picked one marked. */
export function ScriptVersionsList({ onSelect, selected, versions }: { onSelect: (version: number) => void; selected: null | number; versions: ReadonlyArray<ScriptVersion> }) {
    return (
        <ul aria-label="Versions" className="flex flex-col gap-1">
            {versions.map(version => (
                <li key={version.id}>
                    <button
                        aria-current={version.version === selected ? "true" : undefined}
                        className={cn("flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-left hover:bg-muted/50", version.version === selected && "border-brand bg-muted/50")}
                        onClick={() => onSelect(version.version)}
                        type="button"
                    >
                        <span className="font-medium">{`v${version.version}`}</span>
                        <ScriptVersionStatusBadge status={version.status} />
                        <span className="text-muted-foreground">{diagnosticsSummary(version.diagnostics)}</span>
                        <span className="w-full text-xs text-muted-foreground">{formatInstant(version.created_at)}</span>
                    </button>
                </li>
            ))}
        </ul>
    );
}

function DiagnosticLine({ diagnostic }: { diagnostic: ScriptDiagnostic }) {
    return (
        <span className={diagnostic.severity === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400"}>
            {`${diagnostic.severity === "error" ? "Error" : "Warning"} ${diagnostic.code}: ${diagnostic.message}`}
        </span>
    );
}

/** The diagnostics (pure), each linking its line in the source below. */
export function ScriptDiagnosticsList({ diagnostics }: { diagnostics: ReadonlyArray<ScriptDiagnostic> }) {
    if (diagnostics.length === 0) return <p className="text-muted-foreground">No diagnostics: the compiler reported nothing.</p>;

    return (
        <ul className="flex flex-col gap-1" data-testid="script-diagnostics">
            {diagnostics.map((diagnostic, index) => (
                // A diagnostic has no id; the list is the API's, fixed per version.

                <li className="flex flex-wrap gap-x-2" key={index}>
                    <a className="font-mono text-muted-foreground underline-offset-4 hover:underline" href={`#${sourceLineId(diagnostic.line)}`}>{`${diagnostic.line}:${diagnostic.column}`}</a>
                    <DiagnosticLine diagnostic={diagnostic} />
                </li>
            ))}
        </ul>
    );
}

/**
 * The source as uploaded (pure): one element per line with its number and an anchor (`#script-L<n>`); a line with
 * diagnostics is marked and carries their messages, a caret under the reported column. Plain DOM rows: a source has at
 * most 204 800 characters, so a few thousand lines.
 */
export function ScriptSourceView({ diagnostics, source }: { diagnostics: ReadonlyArray<ScriptDiagnostic>; source: string }) {
    const byLine = diagnosticsByLine(diagnostics);

    const lines = source.split(/\r\n|\n|\r/);

    const gutter = String(lines.length).length;

    return (
        <div className="max-h-[70vh] overflow-auto rounded-lg border bg-muted/30 font-mono text-xs" data-testid="script-source">
            {/* As wide as the longest line: the box scrolls sideways, never the page; marked rows span the width. */}
            <div className="w-max min-w-full">
                {lines.map((text, index) => {
                    const line = index + 1;

                    const marks = byLine.get(line);

                    const severity = marks?.some(mark => mark.severity === "error") ? "error" : marks ? "warning" : null;

                    return (
                        <div
                            className={cn("scroll-mt-24 target:bg-primary/15", severity === "error" && "bg-destructive/10", severity === "warning" && "bg-amber-500/10")}
                            data-diagnostic={severity ?? undefined}
                            id={sourceLineId(line)}
                            key={line}
                        >
                            <div className="flex">
                                <span aria-hidden className="shrink-0 border-r px-2 text-right text-muted-foreground select-none" style={{ width: `${gutter + 2}ch` }}>{line}</span>
                                <pre className="flex-1 px-2 whitespace-pre">{text || " "}</pre>
                            </div>
                            {marks?.map((mark, at) => (
                            // Diagnostics of one line keep the API's order.

                                <div className="flex" key={at}>
                                    <span aria-hidden className="shrink-0 border-r px-2" style={{ width: `${gutter + 2}ch` }} />
                                    <pre className="min-w-0 flex-1 px-2 whitespace-pre-wrap">
                                        {`${" ".repeat(Math.max(0, mark.column - 1))}^ `}
                                        <DiagnosticLine diagnostic={mark} />
                                    </pre>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
            {[...byLine.keys()].some(line => line > lines.length || line < 1) && (
                <p className="px-2 py-1 text-muted-foreground">Some diagnostics name a line outside the source; they are listed above.</p>
            )}
        </div>
    );
}

/**
 * One version (pure): status, compiler, hash, id; the inputs its manifest declares (an alert's `condition.inputs`
 * fills them, absent = the default); the condition ids `condition.alert_ids` can name; diagnostics; the source;
 * "Create alert from this version" for a compiled one.
 */
export function ScriptVersionView({ scriptId, version }: { scriptId: string; version: ScriptVersion }) {
    const inputs = manifestInputs(version.manifest);

    return (
        <div className="flex min-w-0 flex-col gap-6" data-testid="script-version">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-section">{`Version ${version.version}`}</h3>
                <ScriptVersionStatusBadge status={version.status} />
                {version.status === "ok"
                    ? (
                            <Link className={buttonVariants({ size: "sm" })} search={{ script: scriptId, type: "script", version: version.id }} to="/alerts/new">
                                Create alert from this version
                            </Link>
                        )
                    : <span className="text-muted-foreground">Fix the errors and upload a new version to use it in alerts.</span>}
            </div>
            <StatGrid>
                <Stat
                    label="Version id"
                    value={(
                        <span className="inline-flex items-center gap-1 font-mono text-sm break-all">
                            {version.id}
                            <CopyButton label="Copy script version id" value={version.id} />
                        </span>
                    )}
                />
                <Stat label="Compiler" value={version.compiler_version} />
                <Stat label="Uploaded" value={formatInstant(version.created_at)} />
                <Stat label="Source SHA-256" value={<span className="font-mono text-xs break-all">{version.source_sha256}</span>} />
            </StatGrid>
            <dl className="flex flex-col">
                <DetailRow label="Alert condition ids">
                    {version.alert_ids.length > 0
                        ? (
                                <div className="flex flex-wrap gap-1">
                                    {version.alert_ids.map(id => <Badge className="font-mono" key={id} variant="outline">{id}</Badge>)}
                                </div>
                            )
                        : <span className="text-muted-foreground">None</span>}
                    <p className="text-muted-foreground text-xs">What a script alert&apos;s condition.alert_ids can name (its alertCondition ids and alert() call sites); empty there = all.</p>
                </DetailRow>
            </dl>
            <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold">Declared inputs</h4>
                {inputs.length > 0
                    ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left" data-testid="script-inputs">
                                    <thead className="text-muted-foreground text-xs">
                                        <tr>
                                            <th className="py-1 pr-3 font-medium">Input</th>
                                            <th className="py-1 pr-3 font-medium">Kind</th>
                                            <th className="py-1 pr-3 font-medium">Default</th>
                                            <th className="py-1 font-medium">Bounds / options</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inputs.map(input => (
                                            <tr className="border-t" key={input.name}>
                                                <td className="py-1.5 pr-3">
                                                    <span className="font-mono">{input.name}</span>
                                                    {input.title !== input.name && <span className="text-muted-foreground">{` · ${input.title}`}</span>}
                                                </td>
                                                <td className="py-1.5 pr-3">{input.kind}</td>
                                                <td className="py-1.5 pr-3 font-mono">{defaultText(input.default)}</td>
                                                <td className="py-1.5">{inputRangeText(input) || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    : <p className="text-muted-foreground">{version.manifest === null ? "No manifest: the compile failed." : "The script declares no inputs."}</p>}
            </div>
            <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold">{`Diagnostics · ${diagnosticsSummary(version.diagnostics)}`}</h4>
                <ScriptDiagnosticsList diagnostics={version.diagnostics} />
            </div>
            <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold">Source</h4>
                <ScriptSourceView diagnostics={version.diagnostics} source={version.source} />
            </div>
        </div>
    );
}

/**
 * A delete refused with 409 `conflict` (pure): the API's words, every alert id they name linked (the contract has no
 * structured list and no `listAlerts` filter by script, so the ids are read from the `detail`), and the way out.
 */
export function ScriptDeleteConflict({ detail }: { detail: string }) {
    const ids = alertIdsInDetail(detail);

    return (
        <Notice badge="In use" title="The script is used by alerts and was not deleted">
            <p>{detail}</p>
            {ids.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2" data-testid="script-conflict-alerts">
                    {ids.map(id => (
                        <li key={id}>
                            <Link className="font-mono text-primary underline-offset-4 hover:underline" params={{ id }} to="/alerts/$id">{id}</Link>
                        </li>
                    ))}
                </ul>
            )}
            <p className="mt-2">Delete those alerts first (or the alerts that read this script as a node of their chain), then delete the script.</p>
        </Notice>
    );
}
