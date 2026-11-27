import * as React from "react";

import type { FilingDocumentTarget } from "@/components/sec/filing-document-dialog";
import type { AsReportedDetailedPeriodTarget, FinancialVintagesTarget, ReportedLookupScope } from "@/lib/api/queries";
import type { V2AsReportedMemberFact, V2StatementPeriod } from "@/lib/api/types";
import type { AsReportedExplanationFact, AsReportedExplanationModel, AsReportedMemberModel } from "@/lib/financials/as-reported-explanation";
import type { ValueRef } from "@/lib/financials/value-ref";

import { FilingDocumentDialog } from "@/components/sec/filing-document-dialog";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsReportedDetailedPeriod, useFinancialVintages } from "@/lib/api/queries";
import { V2_STATEMENT_KEYS } from "@/lib/api/v2";
import { asReportedExplanation } from "@/lib/financials/as-reported-explanation";
import { dimensionsText } from "@/lib/financials/statements";
import { sameDimensions } from "@/lib/financials/value-ref";

import type { PeriodFilingTarget, ValueFilingTarget } from "./explain-parts";
import type { FiledValuesRequest } from "./filed-values";

import {
    ExplainField,
    ExplainFields,
    ExplainSection,
    FilingRef,
    FormulaExpression,
    fullNumber,
    Mono,
    OperandChip,
    PeriodFilingDialog,
    ResultChip,
    ShowInFilingButton,
    ValueFilingDialog,
    ValueHero,
} from "./explain-parts";
import { FiledValuesPanel, filedValuesTitle } from "./filed-values";

/**
 * The as-reported value a reader clicked: its concept (the line id), the fact as answered, its cell's name, the
 * loaded statement rows (a formula member's filing is looked up there first) and its "Filed values" request (company,
 * concept, the period's end and start; null = not known).
 */
export type AsReportedExplainTarget = {
    cik: null | string;
    concept: string;
    detailedPeriod?: AsReportedDetailedPeriodTarget;
    dimensions?: V2AsReportedMemberFact["dimensions"];
    fact: AsReportedExplanationFact;
    memberKey?: string;
    period: string;
    rows?: ReadonlyArray<V2StatementPeriod>;
    scope?: ReportedLookupScope;
    vintages?: FinancialVintagesTarget | null;
};

function MemberChip({ member, mixedConcepts, onOpenValue }: { member: AsReportedMemberModel; mixedConcepts: boolean; onOpenValue?: (ref: ValueRef, title: string) => void }) {
    const { ref } = member;

    return (
        <OperandChip
            chip={{ concept: mixedConcepts ? member.label : null, months: member.months, period: member.period ?? (mixedConcepts ? null : member.label), value: member.value }}
            onOpen={ref && ref.source !== null && onOpenValue ? () => onOpenValue(ref, [member.label, member.period].filter(Boolean).join(" · ")) : undefined}
            sourceTitle={ref?.source === null ? "Filing source unavailable" : ref?.source && !ref.source.elementId ? "Open the filing" : undefined}
        />
    );
}

/**
 * "Explain this number" for an as-reported value (pure): the value up front with how it came about — filed by the
 * company (its place in the filing), or computed by Invinite with its formula as operand chips (each opening its own
 * filing at the value) —, a restatement or split adjustment, and the filing. `onOpenDocument` opens the filing's
 * document — at the value, marked, when its element is known; `onOpenValue` a member's filing. A filed value with a
 * known period offers its "Filed values" (`vintages`: every filing that stated it, on a click).
 */
export function AsReportedExplanationView({ cik, formulaState, model, onOpenDocument, onOpenFiling, onOpenPeriodFiling, onOpenValue, onShowVintages, vintageRequest, vintages = null }: {
    cik: null | string;
    formulaState?: { error: unknown; isLoading: boolean };
    model: AsReportedExplanationModel;
    onOpenDocument: (accession: string, elementId: null | string) => void;
    onOpenFiling: (accession: string) => void;
    /** A computed value's period filing, opened at its table (`PeriodFilingDialog`); absent = the filing's top. */
    onOpenPeriodFiling?: (accession: string, refs: ReadonlyArray<ValueRef>) => void;
    onOpenValue?: (ref: ValueRef, title: string) => void;
    onShowVintages: () => void;
    vintageRequest: FiledValuesRequest | null;
    vintages?: FinancialVintagesTarget | null;
}) {
    const chip = (member: AsReportedMemberModel, index: number) => (
        // The members have no id: their position in the formula is their identity.
        <MemberChip key={index} member={member} mixedConcepts={model.mixedConcepts} onOpenValue={onOpenValue} />
    );

    // A split multiplier may appear only in the operand list, without a term in the formula text.
    const boundMembers = new Set(model.formulaTerms.flatMap(term => term.kind === "operand" && term.member !== null ? [term.member] : []));

    const splitFactors = model.members.flatMap((member, index) => member.splitFactor && !boundMembers.has(index) ? [chip(member, index)] : []);

    const refs = model.members.flatMap(member => (member.ref ? [member.ref] : []));

    const hasTableSource = model.derived && refs.some(ref => ref.source === undefined
        || Boolean(ref.source?.elementId && ref.source.accession === model.accession));

    // A filed value opens at its place, marked; a computed one at the table of its operands in the period's filing.
    const openSource = (accession: string) => {
        if (!model.derived && model.htmlTagId) onOpenDocument(accession, model.htmlTagId);
        else if (hasTableSource && onOpenPeriodFiling) onOpenPeriodFiling(accession, refs);
        else onOpenFiling(accession);
    };

    const openable = model.members.some(member => member.ref && member.ref.source !== null) && onOpenValue !== undefined;

    return (
        <div className="flex min-w-0 flex-col gap-5 [overflow-wrap:anywhere]" data-testid="as-reported-explanation">
            <ValueHero
                action={model.accession && !model.derived && model.htmlTagId
                    ? <ShowInFilingButton elementId={model.htmlTagId} onOpen={() => onOpenDocument(model.accession!, model.htmlTagId)} />
                    : model.accession && hasTableSource && onOpenPeriodFiling
                        ? <ShowInFilingButton elementId={null} label="Show the table in the filing" onOpen={() => openSource(model.accession!)} />
                        : model.accession
                            ? <ShowInFilingButton elementId={null} onOpen={() => openSource(model.accession!)} />
                            : null}
                badge={<Badge variant={model.derived ? "secondary" : "outline"}>{model.derived ? "Computed" : "Filed"}</Badge>}
                caption={model.caption}
                sub={(
                    <>
                        <Mono>{model.concept}</Mono>
                        {model.dimensions?.length ? <div>{dimensionsText(model.dimensions)}</div> : null}
                    </>
                )}
                value={model.value}
            />

            {model.label && (
                <ExplainSection title="Line item">
                    <ExplainFields>
                        <ExplainField label="Caption">{model.caption}</ExplainField>
                        <ExplainField label="Standard label">{model.label}</ExplainField>
                    </ExplainFields>
                </ExplainSection>
            )}

            {model.derived
                ? (
                        <ExplainSection aside={openable ? <span className="text-muted-foreground text-xs">Click an operand to see it in its filing</span> : null} title="Computed by Invinite">
                            <p className="text-muted-foreground">Invinite computed this value from other periods in the filings.</p>
                            {formulaState?.isLoading
                                ? <Skeleton aria-label="Loading formula" className="h-12 w-full" role="status" />
                                : formulaState?.error
                                    ? <SecReadinessNotice error={formulaState.error} operationId="getAsReportedFinancialsDetailed" tierTitle="Your plan does not include formula details" title="Failed to load the formula" />
                                    : model.formulaTerms.length > 0
                                        ? (
                                                <>
                                                    <FormulaExpression
                                                        renderOperand={index => chip(model.members[index], index)}
                                                        result={<ResultChip value={model.value} />}
                                                        terms={model.formulaTerms}
                                                    />
                                                    {splitFactors.length > 0 && <div className="flex flex-wrap gap-1.5">{splitFactors}</div>}
                                                </>
                                            )
                                        : model.members.length > 0
                                            ? <div className="flex flex-wrap gap-1.5">{model.members.map(chip)}</div>
                                            : <span className="text-muted-foreground">Formula not stated.</span>}
                        </ExplainSection>
                    )
                : (
                        <ExplainSection title="Reported by the company">
                            <p className="text-muted-foreground">The value as the company filed it.</p>
                        </ExplainSection>
                    )}

            {model.split && (
                <ExplainSection title="Split adjusted">
                    <ExplainFields>
                        <ExplainField label="As filed"><span className="tabular-nums">{fullNumber(model.split.filed)}</span></ExplainField>
                        <ExplainField label="Factor"><span className="tabular-nums">{fullNumber(model.split.factor)}</span></ExplainField>
                    </ExplainFields>
                </ExplainSection>
            )}

            {model.original && (
                <ExplainSection title="Restated">
                    <ExplainFields>
                        {model.original.value !== null && <ExplainField label="First filed"><span className="tabular-nums">{fullNumber(model.original.value)}</span></ExplainField>}
                        {model.original.label && <ExplainField label="First caption">{model.original.label}</ExplainField>}
                        {model.original.filedOn && <ExplainField label="Filed on">{model.original.filedOn}</ExplainField>}
                        {model.original.accession && (
                            <ExplainField label="First filing">
                                <FilingRef accession={model.original.accession} cik={cik} onOpen={() => onOpenFiling(model.original!.accession!)} />
                            </ExplainField>
                        )}
                    </ExplainFields>
                </ExplainSection>
            )}

            <ExplainSection title="Source">
                {model.accession
                    ? (
                            <ExplainFields>
                                <ExplainField label={model.derived ? "Period's filing" : "Filing"}>
                                    <FilingRef
                                        accession={model.accession}
                                        cik={cik}
                                        // A filed value opens at its place, marked (as the hero's button); else the filing's top.
                                        onOpen={() => openSource(model.accession!)}
                                    />
                                </ExplainField>
                            </ExplainFields>
                        )
                    : <span className="text-muted-foreground">No filing stated.</span>}
            </ExplainSection>

            {/* A computed value (Q4, TTM, YTD) was filed by no one: nothing to list. */}
            {!model.derived && vintages && (
                <ExplainSection title={filedValuesTitle(vintages.member)}>
                    <FiledValuesPanel onShow={onShowVintages} request={vintageRequest} target={vintages} />
                </ExplainSection>
            )}
        </div>
    );
}

/**
 * The dialog around `AsReportedExplanationView`: a filing opens framed (`FilingDocumentDialog`), a formula member's own
 * filing at its value (`ValueFilingDialog`: the loaded rows, else one as-reported detailed request).
 */
export function AsReportedExplainDialog({ onClose, retainedPeriod = null, target }: { onClose: () => void; retainedPeriod?: AsReportedDetailedPeriodTarget | null; target: AsReportedExplainTarget | null }) {
    // Keep the latest on-demand reads visible in the inspector after their dialog closes.
    const details = useAsReportedDetailedPeriod(retainedPeriod);

    const [vintageTarget, setVintageTarget] = React.useState<FinancialVintagesTarget | null>(null);

    const vintageRequest = useFinancialVintages(vintageTarget);

    const detailRow = target?.detailedPeriod ? details.data?.data[0] : undefined;

    const detail = detailRow && target?.detailedPeriod ? detailRow.statements[V2_STATEMENT_KEYS[target.detailedPeriod.statement]] : undefined;

    const exact = !detail || !target
        ? undefined
        : target.memberKey
            ? detail.member_facts.find(member => member.key === target.memberKey)
            : detail.facts[target.concept];

    const matching = exact && "formula" in exact && target && typeof exact.value === "number"
        && Object.is(exact.value, target.fact.value) && exact.derived === target.fact.derived
        && sameDimensions("dimensions" in exact ? exact.dimensions : null, target.dimensions ?? null)
        && (target.fact.accession ?? null) === exact.accession
        ? { ...exact, value: exact.value }
        : undefined;

    const error = target?.detailedPeriod ? details.error ?? (detailRow && !matching ? new Error("No formula was found for the selected value.") : null) : null;

    const model = target ? asReportedExplanation(target.concept, matching ?? target.fact) : null;

    const scope = target?.scope;

    const rows = detailRow && matching ? [detailRow, ...(target?.rows ?? [])] : target?.rows;

    const [document, setDocument] = React.useState<FilingDocumentTarget | null>(null);

    const [value, setValue] = React.useState<null | ValueFilingTarget>(null);

    const [period, setPeriod] = React.useState<null | PeriodFilingTarget>(null);

    return (
        <>
            <Dialog onOpenChange={open => !open && onClose()} open={target !== null}>
                <DialogContent className="sm:max-w-2xl h-[min(44rem,calc(100vh-2rem))] p-0">
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                        <DialogHeader className="p-4 pb-2">
                            <DialogTitle>Explain this number</DialogTitle>
                            <DialogDescription className="[overflow-wrap:anywhere]">{target ? `${target.period} · how the value came about and where it was filed` : null}</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="h-0 min-w-0 grow px-4 pb-4">
                            {model && target && (
                                <AsReportedExplanationView
                                    cik={target.cik}
                                    formulaState={{ error, isLoading: Boolean(target.detailedPeriod) && details.isLoading }}
                                    model={model}
                                    onOpenDocument={(accession, elementId) => setDocument({ accession, elementId, title: target.period })}
                                    onOpenFiling={accession => setDocument({ accession, elementId: null, title: target.period })}
                                    onOpenPeriodFiling={(accession, refs) => setPeriod({ accession, refs, title: target.period })}
                                    onOpenValue={(ref, title) => setValue({ ref, title: `${model.caption} · ${title}` })}
                                    onShowVintages={() => setVintageTarget(target.vintages ?? null)}
                                    vintageRequest={JSON.stringify(vintageTarget) === JSON.stringify(target.vintages) ? vintageRequest : null}
                                    vintages={target.vintages}
                                />
                            )}
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
            <FilingDocumentDialog onClose={() => setDocument(null)} target={document} />
            <ValueFilingDialog cik={target?.cik ?? null} onClose={() => setValue(null)} rows={rows} scope={scope} target={value} />
            <PeriodFilingDialog cik={target?.cik ?? null} onClose={() => setPeriod(null)} rows={rows} scope={scope} target={period} />
        </>
    );
}
