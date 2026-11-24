import * as React from "react";

import type { FilingDocumentTarget } from "@/components/sec/filing-document-dialog";
import type { SecPanelTarget } from "@/components/sec/sec-source-panel";
import type { V2FactPlacesResponse, V2FactResponse } from "@/lib/api/types";
import type { FactOperandModel, FactPlaceTarget } from "@/lib/financials/fact-explanation";
import type { ValueRef } from "@/lib/financials/value-ref";

import { FinancialsStateNotice } from "@/components/financial-metrics/metrics-list-body";
import { FilingDocumentDialog } from "@/components/sec/filing-document-dialog";
import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlanBadge, usePlanAllows } from "@/components/ui/credit-hint";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2Fact, useV2FactPlaces } from "@/lib/api/queries";
import { factExplanationModel, factPlaceTargets, readableFormula } from "@/lib/financials/fact-explanation";
import { formulaTerms } from "@/lib/financials/formula-terms";

import type { ValueFilingTarget } from "./explain-parts";

import {
    ExplainField,
    ExplainFields,
    ExplainSection,
    FilingRef,
    FormulaExpression,
    fullNumber,
    Mono,
    OperandChip,
    ResultChip,
    ShowInFilingButton,
    ValueFilingDialog,
    ValueHero,
} from "./explain-parts";

/**
 * The value cell a reader clicked: its fact id, the formula the detailed view already carries and the filing the value
 * comes from with its inline-XBRL element ("Open the filing" at the value; null element = at the top).
 */
export type ExplainTarget = { accession?: null | string; factId: string; formula: null | string | undefined; htmlTagId?: null | string; period: string };

type Loadable<T> = { data: null | T | undefined; error: unknown; isLoading: boolean };

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
 * "Explain this number" (pure): the standardized fact's value up front (its place in the filing as the action), the
 * mapping rule that produced it, the formula as operand chips (a raw operand opens its own filing at the value), the
 * reported facts it rests on (each opening its filing at its element) and the places in the filed document.
 */
export function FactExplanationView({ fact, filing = null, formula, onOpenFiling, onOpenPlace, onOpenSource, onOpenValue, places }: {
    fact: Loadable<V2FactResponse>;
    /** The clicked value's own filing: "Open the filing" (at the value when `elementId` is set). */
    filing?: null | { elementId: null | string; onOpen: () => void };
    formula: null | string | undefined;
    onOpenFiling: (accession: string) => void;
    onOpenPlace: (target: FactPlaceTarget) => void;
    /** A source fact's filing at its element (default: `onOpenFiling`, at the top). */
    onOpenSource?: (accession: string, elementId: null | string) => void;
    /** An operand's own filing, looked up by concept and period. */
    onOpenValue?: (ref: ValueRef, title: string) => void;
    /** null = the plan lacks the places operation (no request was sent). */
    places: Loadable<V2FactPlacesResponse> | null;
}) {
    const model = React.useMemo(() => (fact.data ? factExplanationModel(fact.data) : null), [fact.data]);

    const stated = formula ?? model?.rule.formula ?? null;

    const terms = React.useMemo(() => (stated && model ? formulaTerms(stated, model.operands.map(operand => operand.ref)) : []), [model, stated]);

    if (fact.error) return <FinancialsStateNotice error={fact.error} pendingTitle="Explanation is being prepared" title="Failed to explain this value" />;

    if (fact.isLoading || !model || !fact.data) return <Skeleton className="h-48 w-full" />;

    const cik = fact.data.company.cik;

    const concepts = new Set(model.operands.map(operand => operand.concept ?? operand.label));

    const mixed = concepts.size > 1;

    const sharedConcept = !mixed ? model.operands.at(0)?.concept ?? null : null;

    const matched = new Set(terms.flatMap(term => (term.kind === "operand" && term.member !== null ? [term.member] : [])));

    const openable = onOpenValue !== undefined && model.operands.some(operand => operand.ref !== null);

    const chip = (operand: FactOperandModel, index: number) => {
        const { ref } = operand;

        return (
            // The operand tree has no id: its position is its identity.
            <OperandChip
                chip={{
                    concept: mixed ? operand.concept ?? operand.label : null,
                    months: operand.months,
                    period: operand.period ?? (mixed ? null : (operand.nested > 0 ? `${operand.label} (${operand.nested} more)` : operand.label)),
                    value: terms.length > 0 ? operand.stored : operand.value,
                }}
                key={index}
                onOpen={ref && onOpenValue ? () => onOpenValue(ref, [operand.concept, operand.period].filter(Boolean).join(" · ")) : undefined}
            />
        );
    };

    const openSource = (accession: string, anchor: null | string) => (onOpenSource ? onOpenSource(accession, anchor) : onOpenFiling(accession));

    return (
        <div className="flex min-w-0 flex-col gap-5 [overflow-wrap:anywhere]" data-testid="fact-explanation">
            <ValueHero
                action={filing ? <ShowInFilingButton elementId={filing.elementId} onOpen={filing.onOpen} /> : null}
                caption={model.metricName}
                sub={<Mono>{model.factId}</Mono>}
                unit={model.unit}
                value={model.value}
            />

            <ExplainSection aside={openable && terms.length > 0 ? <span className="text-muted-foreground text-xs">Click an operand to see it in its filing</span> : null} title="Rule">
                <ExplainFields>
                    {model.rule.kind && <ExplainField label="Kind"><Badge variant="outline">{model.rule.kind}</Badge></ExplainField>}
                    {model.rule.alias && <ExplainField label="Takes"><Mono>{model.rule.alias}</Mono></ExplainField>}
                    {terms.length === 0 && <ExplainField label="Formula">None: the value is reported as filed</ExplainField>}
                    {model.rule.notes && <ExplainField label="Notes"><span className="text-muted-foreground text-xs leading-relaxed">{model.rule.notes}</span></ExplainField>}
                </ExplainFields>
                {terms.length > 0 && (
                    <div className="flex flex-col gap-1.5 border-t pt-2">
                        <span className="text-muted-foreground">
                            Formula
                            {sharedConcept && (
                                <>
                                    {" · "}
                                    <Mono>{sharedConcept}</Mono>
                                </>
                            )}
                        </span>
                        <FormulaExpression
                            fallbackText={readableFormula}
                            renderOperand={index => chip(model.operands[index], index)}
                            result={<ResultChip value={model.value} />}
                            terms={terms}
                        />
                    </div>
                )}
            </ExplainSection>

            {model.operands.length > matched.size && (
                <ExplainSection title="Operands">
                    <div className="flex flex-wrap gap-1.5">{model.operands.map((operand, index) => (matched.has(index) ? null : chip(operand, index)))}</div>
                </ExplainSection>
            )}

            <ExplainSection title="Source facts">
                {model.sources.length === 0
                    ? <span className="text-muted-foreground">None stated.</span>
                    : (
                            <ul className="flex flex-col gap-2">
                                {model.sources.map((source, index) => (
                                    // The source facts have no id: their position is their identity.
                                    <li className="bg-background flex flex-col gap-1.5 rounded-md border p-2.5" key={index}>
                                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                                            <Mono className="font-medium">{source.concept}</Mono>
                                            <span className="font-medium tabular-nums">{fullNumber(source.value)}</span>
                                        </div>
                                        {(source.period || source.segment) && (
                                            <span className="text-muted-foreground text-xs">{[source.period, source.segment].filter(Boolean).join(" · ")}</span>
                                        )}
                                        {source.accession && (
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                                <FilingRef accession={source.accession} cik={cik} onOpen={() => onOpenFiling(source.accession!)} />
                                                {source.anchor && (
                                                    <ShowInFilingButton elementId={source.anchor} label="Open at the value" onOpen={() => openSource(source.accession!, source.anchor)} />
                                                )}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
            </ExplainSection>

            <ExplainSection aside={<PlanBadge operationId="listFactPlaces" />} title="Show in filing">
                <span className="text-muted-foreground">Where the value sits in the filed document</span>
                <PlacesBlock onOpenPlace={onOpenPlace} places={places} />
            </ExplainSection>
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

    const [value, setValue] = React.useState<null | ValueFilingTarget>(null);

    const valueFiling = target?.accession ?? null;

    return (
        <>
            <Dialog onOpenChange={open => !open && onClose()} open={target !== null}>
                <DialogContent className="sm:max-w-2xl h-[min(48rem,calc(100vh-2rem))] p-0">
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
                                    onOpenFiling={accession => setDocument({ accession, elementId: null, title: target.period })}
                                    onOpenPlace={place => setSource({ blockId: place.blockId, kind: "citation", title: `${target.period} in the filing · ${place.label.toLowerCase()}`, versionId: place.versionId })}
                                    onOpenSource={(accession, elementId) => setDocument({ accession, elementId, title: target.period })}
                                    onOpenValue={(ref, title) => setValue({ ref, title })}
                                    places={placesAllowed === false ? null : { data: places.data, error: places.error, isLoading: places.isLoading }}
                                />
                            )}
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
            <SecSourceDialog onClose={() => setSource(null)} target={source} />
            <FilingDocumentDialog onClose={() => setDocument(null)} target={document} />
            <ValueFilingDialog cik={fact.data?.company.cik ?? null} onClose={() => setValue(null)} target={value} />
        </>
    );
}
