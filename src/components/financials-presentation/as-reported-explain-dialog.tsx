import * as React from "react";

import type { FilingDocumentTarget } from "@/components/sec/filing-document-dialog";
import type { FinancialVintagesTarget } from "@/lib/api/queries";
import type { V2AsReportedDetailedFact, V2StatementPeriod } from "@/lib/api/types";
import type { AsReportedExplanationModel, AsReportedMemberModel } from "@/lib/financials/as-reported-explanation";
import type { ValueRef } from "@/lib/financials/value-ref";

import { FilingDocumentDialog } from "@/components/sec/filing-document-dialog";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { asReportedExplanation } from "@/lib/financials/as-reported-explanation";

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
import { FiledValuesPanel } from "./filed-values";

/**
 * The as-reported value a reader clicked: its concept (the line id), the fact as answered, its cell's name, the
 * loaded statement rows (a formula member's filing is looked up there first) and its "Filed values" request (company,
 * concept, the period's end and start; null = not known).
 */
export type AsReportedExplainTarget = {
    cik: null | string;
    concept: string;
    fact: V2AsReportedDetailedFact;
    period: string;
    rows?: ReadonlyArray<V2StatementPeriod>;
    vintages?: FinancialVintagesTarget | null;
};

function MemberChip({ member, mixedConcepts, onOpenValue }: { member: AsReportedMemberModel; mixedConcepts: boolean; onOpenValue?: (ref: ValueRef, title: string) => void }) {
    const { ref } = member;

    return (
        <OperandChip
            chip={{ concept: mixedConcepts ? member.label : null, months: member.months, period: member.period ?? (mixedConcepts ? null : member.label), value: member.value }}
            onOpen={ref && onOpenValue ? () => onOpenValue(ref, [member.label, member.period].filter(Boolean).join(" · ")) : undefined}
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
export function AsReportedExplanationView({ cik, model, onOpenDocument, onOpenFiling, onOpenValue, vintages = null }: {
    cik: null | string;
    model: AsReportedExplanationModel;
    onOpenDocument: (accession: string, elementId: null | string) => void;
    onOpenFiling: (accession: string) => void;
    onOpenValue?: (ref: ValueRef, title: string) => void;
    vintages?: FinancialVintagesTarget | null;
}) {
    const chip = (member: AsReportedMemberModel, index: number) => (
        // The members have no id: their position in the formula is their identity.
        <MemberChip key={index} member={member} mixedConcepts={model.mixedConcepts} onOpenValue={onOpenValue} />
    );

    const openable = model.members.some(member => member.ref !== null) && onOpenValue !== undefined;

    return (
        <div className="flex min-w-0 flex-col gap-5 [overflow-wrap:anywhere]" data-testid="as-reported-explanation">
            <ValueHero
                action={model.accession && !model.derived && model.htmlTagId
                    ? <ShowInFilingButton elementId={model.htmlTagId} onOpen={() => onOpenDocument(model.accession!, model.htmlTagId)} />
                    : null}
                badge={<Badge variant={model.derived ? "secondary" : "outline"}>{model.derived ? "Computed" : "Filed"}</Badge>}
                caption={model.caption}
                sub={<Mono>{model.concept}</Mono>}
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
                            <p className="text-muted-foreground">The company did not file this period on its own (a Q4, TTM or YTD value): Invinite computed it from the filed values below.</p>
                            {model.formulaTerms.length > 0
                                ? (
                                        <FormulaExpression
                                            renderOperand={index => chip(model.members[index], index)}
                                            result={<ResultChip value={model.value} />}
                                            terms={model.formulaTerms}
                                        />
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
                                    <FilingRef accession={model.accession} cik={cik} onOpen={() => onOpenFiling(model.accession!)} />
                                </ExplainField>
                            </ExplainFields>
                        )
                    : <span className="text-muted-foreground">No filing stated.</span>}
            </ExplainSection>

            {/* A computed value (Q4, TTM, YTD) was filed by no one: nothing to list. */}
            {!model.derived && vintages && (
                <ExplainSection title="Filed values">
                    <FiledValuesPanel key={`${vintages.concept}|${vintages.periodEnd}|${vintages.periodStart ?? ""}`} target={vintages} />
                </ExplainSection>
            )}
        </div>
    );
}

/**
 * The dialog around `AsReportedExplanationView`: a filing opens framed (`FilingDocumentDialog`), a formula member's own
 * filing at its value (`ValueFilingDialog`: the loaded rows, else one as-reported detailed request).
 */
export function AsReportedExplainDialog({ onClose, target }: { onClose: () => void; target: AsReportedExplainTarget | null }) {
    const model = React.useMemo(() => (target ? asReportedExplanation(target.concept, target.fact) : null), [target]);

    const [document, setDocument] = React.useState<FilingDocumentTarget | null>(null);

    const [value, setValue] = React.useState<null | ValueFilingTarget>(null);

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
                                    model={model}
                                    onOpenDocument={(accession, elementId) => setDocument({ accession, elementId, title: target.period })}
                                    onOpenFiling={accession => setDocument({ accession, elementId: null, title: target.period })}
                                    onOpenValue={(ref, title) => setValue({ ref, title: `${model.caption} · ${title}` })}
                                    vintages={target.vintages}
                                />
                            )}
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
            <FilingDocumentDialog onClose={() => setDocument(null)} target={document} />
            <ValueFilingDialog cik={target?.cik ?? null} onClose={() => setValue(null)} rows={target?.rows} target={value} />
        </>
    );
}
