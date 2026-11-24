import * as React from "react";

import type { FilingDocumentTarget } from "@/components/sec/filing-document-dialog";
import type { SecPanelTarget } from "@/components/sec/sec-source-panel";
import type { V2AsReportedDetailedFact } from "@/lib/api/types";
import type { AsReportedExplanationModel } from "@/lib/financials/as-reported-explanation";

import { FilingDocumentDialog, OpenFilingButton } from "@/components/sec/filing-document-dialog";
import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { edgarFolderUrl } from "@/lib/earnings/edgar";
import { asReportedExplanation } from "@/lib/financials/as-reported-explanation";
import { formatNumberEn } from "@/lib/utils";

/** The as-reported value a reader clicked: its concept (the line id), the fact as answered and its cell's name. */
export type AsReportedExplainTarget = { cik: null | string; concept: string; fact: V2AsReportedDetailedFact; period: string };

const full = (value: null | number) => (value === null ? "—" : formatNumberEn(value, { maximumFractionDigits: 6 }));

function Section({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">{title}</h3>
            <div className="text-sm">{children}</div>
        </section>
    );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <span className="text-muted-foreground shrink-0 sm:w-28">{label}</span>
            <span className="min-w-0 break-words">{children}</span>
        </div>
    );
}

function FilingLinks({ accession, cik, onOpenFiling }: { accession: string; cik: null | string; onOpenFiling: (accession: string) => void }) {
    const edgar = cik ? edgarFolderUrl(cik, accession) : null;

    return (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button className="font-medium underline-offset-4 hover:underline" onClick={() => onOpenFiling(accession)} type="button">{accession}</button>
            {edgar && <a className="text-muted-foreground underline-offset-4 hover:underline" href={edgar} rel="noopener noreferrer" target="_blank">EDGAR</a>}
        </span>
    );
}

/**
 * "Explain this number" for an as-reported value (pure): the caption and concept, how the value came about — filed by
 * the company, or computed by Invinite with its formula and operands —, a restatement or split adjustment, and the
 * filing. `onOpenDocument` opens the filing's document — at the value, marked, when its element is known.
 */
export function AsReportedExplanationView({ cik, model, onOpenDocument, onOpenFiling }: {
    cik: null | string;
    model: AsReportedExplanationModel;
    onOpenDocument: (accession: string, elementId: null | string) => void;
    onOpenFiling: (accession: string) => void;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-5 [overflow-wrap:anywhere]" data-testid="as-reported-explanation">
            <Section title="Value">
                <Field label="Caption">{model.caption}</Field>
                {model.label && <Field label="Standard label">{model.label}</Field>}
                <Field label="Concept"><code className="text-xs">{model.concept}</code></Field>
                <Field label="Value"><span className="tabular-nums">{full(model.value)}</span></Field>
            </Section>

            <Section title={model.derived ? "Computed by Invinite" : "Reported by the company"}>
                {model.derived
                    ? (
                            <>
                                <span className="text-muted-foreground">The company did not file this period on its own (a Q4, TTM or YTD value): Invinite computed it from the filed values below.</span>
                                <Field label="Formula">{model.formula ? <code className="text-xs">{model.formula}</code> : "Not stated"}</Field>
                            </>
                        )
                    : <span className="text-muted-foreground">The value as the company filed it.</span>}
            </Section>

            {model.members.length > 0 && (
                <Section title="Operands">
                    <ul className="flex flex-col gap-2">
                        {model.members.map((member, index) => (
                            // The members have no id: their position in the formula is their identity.
                            <li className="flex justify-between gap-4" key={index}>
                                <span className="flex min-w-0 flex-col">
                                    <code className="text-xs">{member.label}</code>
                                    {member.period && <span className="text-muted-foreground text-xs">{member.period}</span>}
                                </span>
                                <span className="tabular-nums">{full(member.value)}</span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {model.split && (
                <Section title="Split adjusted">
                    <Field label="As filed"><span className="tabular-nums">{full(model.split.filed)}</span></Field>
                    <Field label="Factor"><span className="tabular-nums">{full(model.split.factor)}</span></Field>
                </Section>
            )}

            {model.original && (
                <Section title="Restated">
                    {model.original.value !== null && <Field label="First filed"><span className="tabular-nums">{full(model.original.value)}</span></Field>}
                    {model.original.label && <Field label="First caption">{model.original.label}</Field>}
                    {model.original.filedOn && <Field label="Filed on">{model.original.filedOn}</Field>}
                    {model.original.accession && <Field label="First filing"><FilingLinks accession={model.original.accession} cik={cik} onOpenFiling={onOpenFiling} /></Field>}
                </Section>
            )}

            <Section title="Source">
                {model.accession
                    ? <Field label="Filing"><FilingLinks accession={model.accession} cik={cik} onOpenFiling={onOpenFiling} /></Field>
                    : <span className="text-muted-foreground">No filing stated.</span>}
                {model.accession && (
                    <Field label="In the filing">
                        <OpenFilingButton elementId={model.htmlTagId} onOpen={() => onOpenDocument(model.accession!, model.htmlTagId)} />
                    </Field>
                )}
            </Section>
        </div>
    );
}

/** The dialog around `AsReportedExplanationView`; "Open the filing" frames the filing's document (`FilingDocumentDialog`). */
export function AsReportedExplainDialog({ onClose, target }: { onClose: () => void; target: AsReportedExplainTarget | null }) {
    const model = React.useMemo(() => (target ? asReportedExplanation(target.concept, target.fact) : null), [target]);

    const [source, setSource] = React.useState<null | SecPanelTarget>(null);

    const [document, setDocument] = React.useState<FilingDocumentTarget | null>(null);

    return (
        <>
            <Dialog onOpenChange={open => !open && onClose()} open={target !== null}>
                <DialogContent className="sm:max-w-2xl h-[min(40rem,calc(100vh-2rem))] p-0">
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                        <DialogHeader className="p-4 pb-2">
                            <DialogTitle>Explain this number</DialogTitle>
                            <DialogDescription className="[overflow-wrap:anywhere]">{target ? `${target.period} · how the value came about and where it was filed` : null}</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="h-0 min-w-0 grow px-4 pb-4">
                            {model && target && (
                                <AsReportedExplanationView
                                    cik={target.cik}
                                    model={model}
                                    onOpenDocument={(accession, elementId) => setDocument({ accession, elementId, title: target.period })}
                                    onOpenFiling={accession => setSource({ accession, kind: "filing" })}
                                />
                            )}
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
            <SecSourceDialog onClose={() => setSource(null)} target={source} />
            <FilingDocumentDialog onClose={() => setDocument(null)} target={document} />
        </>
    );
}
