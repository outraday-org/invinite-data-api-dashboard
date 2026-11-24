import * as React from "react";

import type { FilingDocumentTarget } from "@/components/sec/filing-document-dialog";
import type { SecPanelTarget } from "@/components/sec/sec-source-panel";
import type { V2FactPlacesResponse, V2FactResponse } from "@/lib/api/types";
import type { FactPlaceTarget } from "@/lib/financials/fact-explanation";

import { FinancialsStateNotice } from "@/components/financial-metrics/metrics-list-body";
import { FilingDocumentDialog, OpenFilingButton } from "@/components/sec/filing-document-dialog";
import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { Button } from "@/components/ui/button";
import { PlanBadge, usePlanAllows } from "@/components/ui/credit-hint";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2Fact, useV2FactPlaces } from "@/lib/api/queries";
import { edgarFolderUrl } from "@/lib/earnings/edgar";
import { factExplanationModel, factPlaceTargets, readableFormula } from "@/lib/financials/fact-explanation";
import { formatNumberEn } from "@/lib/utils";

/**
 * The value cell a reader clicked: its fact id, the formula the detailed view already carries and the filing the value
 * comes from with its inline-XBRL element ("Open the filing" at the value; null element = at the top).
 */
export type ExplainTarget = { accession?: null | string; factId: string; formula: null | string | undefined; htmlTagId?: null | string; period: string };

type Loadable<T> = { data: null | T | undefined; error: unknown; isLoading: boolean };

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

/**
 * "Show in filing": the placed spots of the fact's source facts, each opening the document at its block. `places` null =
 * the plan lacks `listFactPlaces` (known from `/v1/me` before any request: nothing is asked).
 */
function PlacesBlock({ onOpenPlace, places }: { onOpenPlace: (target: FactPlaceTarget) => void; places: Loadable<V2FactPlacesResponse> | null }) {
    const targets = React.useMemo(() => factPlaceTargets(places?.data?.data ?? []), [places?.data]);

    if (places === null) return <Notice badge="PRO" title="Your plan does not include the places in the filing" />;

    if (places.error) return <FinancialsStateNotice error={places.error} pendingTitle="The places are being resolved" title="Failed to load the places" />;

    if (places.isLoading) return <Skeleton className="h-6 w-48" />;

    if (targets.length === 0) {
        return (
            <div className="flex flex-col gap-1">
                <FinancialsStateNotice coverage={places.data?.meta.coverage} pendingTitle="The places are being resolved" title="Places" />
                <span className="text-muted-foreground">No place of this value in a stored document.</span>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap gap-2">
            {targets.map(target => (
                <Button key={`${target.versionId}:${target.blockId}`} onClick={() => onOpenPlace(target)} size="sm" variant="outline">
                    {target.label}
                </Button>
            ))}
        </div>
    );
}

/**
 * "Explain this number" (pure): the standardized fact's value, the mapping rule that produced it, the formula and its
 * operands, the reported facts it rests on (each with its filing) and the places in the filed document.
 */
export function FactExplanationView({ fact, filing = null, formula, onOpenFiling, onOpenPlace, places }: {
    fact: Loadable<V2FactResponse>;
    /** The clicked value's own filing: "Open the filing" (at the value when `elementId` is set). */
    filing?: null | { elementId: null | string; onOpen: () => void };
    formula: null | string | undefined;
    onOpenFiling: (accession: string) => void;
    onOpenPlace: (target: FactPlaceTarget) => void;
    /** null = the plan lacks the places operation (no request was sent). */
    places: Loadable<V2FactPlacesResponse> | null;
}) {
    const model = React.useMemo(() => (fact.data ? factExplanationModel(fact.data) : null), [fact.data]);

    if (fact.error) return <FinancialsStateNotice error={fact.error} pendingTitle="Explanation is being prepared" title="Failed to explain this value" />;

    if (fact.isLoading || !model || !fact.data) return <Skeleton className="h-48 w-full" />;

    const cik = fact.data.company.cik;

    const stated = formula ?? model.rule.formula;

    // Raw fact ids in a derived value's formula read as concept + period (F036).
    const shownFormula = stated ? readableFormula(stated) : null;

    return (
        <div className="flex min-w-0 flex-col gap-5 [overflow-wrap:anywhere]" data-testid="fact-explanation">
            <Section title="Value">
                <Field label="Metric">{model.metricName}</Field>
                <Field label="Value"><span className="tabular-nums">{`${full(model.value)}${model.unit ? ` ${model.unit.toUpperCase()}` : ""}`}</span></Field>
                <Field label="Fact id"><code className="text-xs">{model.factId}</code></Field>
                {filing && <Field label="Filing"><OpenFilingButton elementId={filing.elementId} onOpen={filing.onOpen} /></Field>}
            </Section>

            <Section title="Rule">
                {model.rule.kind && <Field label="Kind">{model.rule.kind}</Field>}
                {model.rule.alias && <Field label="Takes"><code className="text-xs">{model.rule.alias}</code></Field>}
                <Field label="Formula">{shownFormula ? <code className="text-xs">{shownFormula}</code> : "None: the value is reported as filed"}</Field>
                {model.rule.notes && <Field label="Notes"><span className="text-muted-foreground">{model.rule.notes}</span></Field>}
            </Section>

            {model.operands.length > 0 && (
                <Section title="Operands">
                    <ul className="flex flex-col gap-1">
                        {model.operands.map((operand, index) => (
                            // The operand tree has no id: its position is its identity.
                            <li className="flex justify-between gap-4" key={index}>
                                <span>{operand.nested > 0 ? `${operand.label} (${operand.nested} more)` : operand.label}</span>
                                <span className="tabular-nums">{full(operand.value)}</span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            <Section title="Source facts">
                {model.sources.length === 0
                    ? <span className="text-muted-foreground">None stated.</span>
                    : (
                            <ul className="flex flex-col gap-3">
                                {model.sources.map((source, index) => {
                                    const edgar = edgarFolderUrl(cik, source.accession);

                                    return (
                                        <li className="flex flex-col gap-1 rounded-md border p-2" key={index}>
                                            <Field label="Concept"><code className="text-xs">{source.concept}</code></Field>
                                            <Field label="Value"><span className="tabular-nums">{full(source.value)}</span></Field>
                                            {source.period && <Field label="Period">{source.period}</Field>}
                                            {source.segment && <Field label="Segment">{source.segment}</Field>}
                                            {source.accession && (
                                                <Field label="Filing">
                                                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                        <button className="font-medium underline-offset-4 hover:underline" onClick={() => onOpenFiling(source.accession!)} type="button">
                                                            {source.accession}
                                                        </button>
                                                        {edgar && <a className="text-muted-foreground underline-offset-4 hover:underline" href={edgar} rel="noopener noreferrer" target="_blank">EDGAR</a>}
                                                        {source.anchor && <span className="text-muted-foreground text-xs">{`element ${source.anchor}`}</span>}
                                                    </span>
                                                </Field>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
            </Section>

            <Section title="Show in filing">
                <div className="flex items-center gap-2 pb-1">
                    <span className="text-muted-foreground">Where the value sits in the filed document</span>
                    <PlanBadge operationId="listFactPlaces" />
                </div>
                <PlacesBlock onOpenPlace={onOpenPlace} places={places} />
            </Section>
        </div>
    );
}

/** The dialog around `FactExplanationView`: asks `/v1/facts/{id}` and `/v1/fact-places?fact=` while open. */
export function FactExplainDialog({ onClose, target }: { onClose: () => void; target: ExplainTarget | null }) {
    const factId = target?.factId ?? null;

    const fact = useV2Fact(factId);

    // A plan known to lack the PRO places operation sends no request (`null` = unknown plan: asked, a 403 is its notice).
    const placesAllowed = usePlanAllows("listFactPlaces");

    const places = useV2FactPlaces(placesAllowed === false ? null : factId);

    const [source, setSource] = React.useState<null | SecPanelTarget>(null);

    const [document, setDocument] = React.useState<FilingDocumentTarget | null>(null);

    const valueFiling = target?.accession ?? null;

    return (
        <>
            <Dialog onOpenChange={open => !open && onClose()} open={target !== null}>
                <DialogContent className="sm:max-w-2xl h-[min(44rem,calc(100vh-2rem))] p-0">
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                        <DialogHeader className="p-4 pb-2">
                            <DialogTitle>Explain this number</DialogTitle>
                            <DialogDescription className="[overflow-wrap:anywhere]">{target ? `${target.period} · how the value was standardized and where it was filed` : null}</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="h-0 min-w-0 grow px-4 pb-4">
                            {target && (
                                <FactExplanationView
                                    fact={{ data: fact.data, error: fact.error, isLoading: fact.isLoading }}
                                    filing={valueFiling
                                        ? { elementId: target.htmlTagId ?? null, onOpen: () => setDocument({ accession: valueFiling, elementId: target.htmlTagId ?? null, title: target.period }) }
                                        : null}
                                    formula={target.formula}
                                    onOpenFiling={accession => setSource({ accession, kind: "filing" })}
                                    onOpenPlace={place => setSource({ blockId: place.blockId, kind: "citation", title: `${target.period} in the filing · ${place.label.toLowerCase()}`, versionId: place.versionId })}
                                    places={placesAllowed === false ? null : { data: places.data, error: places.error, isLoading: places.isLoading }}
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
