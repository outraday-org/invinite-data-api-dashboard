import { ExternalLink, FileSearch } from "lucide-react";
import * as React from "react";

import type { ReportedLookupScope } from "@/lib/api/queries";
import type { V2StatementPeriod } from "@/lib/api/types";
import type { FormulaTerm } from "@/lib/financials/formula-terms";
import type { ValueRef } from "@/lib/financials/value-ref";

import { FilingDocumentDialog } from "@/components/sec/filing-document-dialog";
import { useReportedValueLookup } from "@/lib/api/queries";
import { edgarFolderUrl } from "@/lib/earnings/edgar";
import { findValueSource, refMonths, sourceInScope, valueLookupOf } from "@/lib/financials/value-ref";
import { cn, formatNumberEn } from "@/lib/utils";

/** A value at full magnitude ("—" when absent). */
export const fullNumber = (value: null | number) => (value === null ? "—" : formatNumberEn(value, { maximumFractionDigits: 6 }));

/**
 * One block of an explanation (ui-redesign task 9: a section, no card in the dialog): a hairline above, the 14 px title
 * (with an optional note beside it), the content at data size.
 */
export function ExplainSection({ aside, children, title }: { aside?: React.ReactNode; children: React.ReactNode; title: string }) {
    return (
        <section className="flex flex-col gap-2 border-t pt-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-sm font-semibold">{title}</h3>
                {aside}
            </div>
            <div className="flex flex-col gap-2">{children}</div>
        </section>
    );
}

/** Label / value pairs of a section: one grid, labels in one column from `sm` up. */
export function ExplainFields({ children }: { children: React.ReactNode }) {
    return <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-[8rem_minmax(0,1fr)]">{children}</dl>;
}

export function ExplainField({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mb-1 min-w-0 break-words sm:mb-0">{children}</dd>
        </>
    );
}

/** A concept / fact id in the mono face. */
export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
    return <code className={cn("font-mono text-xs [overflow-wrap:anywhere]", className)}>{children}</code>;
}

/** The explained value up front: what it is, the number, how it came about and the main action. */
export function ValueHero({ action, badge, caption, sub, unit, value }: {
    action?: React.ReactNode;
    badge?: React.ReactNode;
    caption: string;
    sub?: React.ReactNode;
    unit?: null | string;
    value: null | number;
}) {
    return (
        <div className="flex flex-col gap-2 rounded-lg border p-4" data-testid="explain-hero">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{caption}</span>
                {badge}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{fullNumber(value)}</span>
                {unit && <span className="text-muted-foreground text-xs font-medium">{` ${unit.toUpperCase()}`}</span>}
            </div>
            {sub && <div className="text-muted-foreground text-xs">{sub}</div>}
            {action && <div className="pt-1">{action}</div>}
        </div>
    );
}

/** The value's place in its filing as the hero's action ("Open the filing" when no element is known). */
export function ShowInFilingButton({ elementId, label, onOpen }: { elementId: null | string; label?: string; onOpen: () => void }) {
    return (
        <button
            className="text-primary border-primary/40 bg-primary/5 hover:bg-primary/10 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
            onClick={onOpen}
            type="button"
        >
            <FileSearch className="size-3.5" />
            {label ?? (elementId ? "Show the value in the filing" : "Open the filing")}
        </button>
    );
}

/** An accession that opens its filing, and the EDGAR folder beside it. */
export function FilingRef({ accession, cik, onOpen }: { accession: string; cik: null | string; onOpen: () => void }) {
    const edgar = cik ? edgarFolderUrl(cik, accession) : null;

    return (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button className="font-mono text-xs font-medium underline-offset-4 hover:underline" onClick={onOpen} type="button">{accession}</button>
            {edgar && (
                <a className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs" href={edgar} rel="noopener noreferrer" target="_blank">
                    EDGAR
                    <ExternalLink className="size-3" />
                </a>
            )}
        </span>
    );
}

/** One operand of a formula: its period (and concept when the operands differ), its value; a click opens its filing. */
export type OperandChipModel = { concept: null | string; months: null | number; period: null | string; value: null | number };

const CHIP_CLASS = "bg-background inline-flex min-w-0 flex-col items-start gap-0.5 rounded-md border px-2.5 py-1.5 text-left";

export function OperandChip({ chip, onOpen, sourceTitle }: { chip: OperandChipModel; onOpen?: () => void; sourceTitle?: string }) {
    const body = (
        <>
            {chip.concept && <Mono className="text-[0.6875rem] font-medium">{chip.concept}</Mono>}
            {chip.period && (
                <span className="text-muted-foreground text-[0.6875rem]">
                    {chip.months ? `${chip.period} · ${chip.months} mo` : chip.period}
                </span>
            )}
            <span className="flex items-center gap-1.5 font-medium tabular-nums">
                {fullNumber(chip.value)}
                {onOpen && <FileSearch aria-hidden className="text-muted-foreground group-hover/chip:text-primary size-3" />}
            </span>
        </>
    );

    if (!onOpen) return <span className={CHIP_CLASS} title={sourceTitle}>{body}</span>;

    return (
        <button
            className={cn(CHIP_CLASS, "group/chip hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-ring transition-colors focus-visible:outline-2")}
            onClick={onOpen}
            title={sourceTitle ?? "Show this value in its filing"}
            type="button"
        >
            {body}
        </button>
    );
}

/** An operand the formula names but no member describes ("FY", a metric id): its text as a quiet chip. */
function TextChip({ text }: { text: string }) {
    return <span className={cn(CHIP_CLASS, "justify-center")}><Mono>{text}</Mono></span>;
}

/**
 * A formula as a row of chips: each operand is `renderOperand(member index)` (null = no member: the operand's text, a
 * raw fact id in words via `fallbackText`), the operators between them, and `= result` at the end.
 */
export function FormulaExpression({ fallbackText, renderOperand, result, terms }: {
    fallbackText?: (text: string) => string;
    renderOperand: (member: number) => React.ReactNode;
    result?: React.ReactNode;
    terms: ReadonlyArray<FormulaTerm>;
}) {
    return (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="formula-expression">
            {terms.map((term, index) => {
                // The terms have no id: their position in the formula is their identity.
                if (term.kind === "operator") return <span className="text-muted-foreground px-0.5 text-base font-medium" key={index}>{term.text}</span>;

                if (term.kind === "paren") return <span className="text-muted-foreground text-lg font-light" key={index}>{term.text}</span>;

                return (
                    <React.Fragment key={index}>
                        {term.member === null ? <TextChip text={fallbackText?.(term.text) ?? term.text} /> : renderOperand(term.member)}
                    </React.Fragment>
                );
            })}
            {result && (
                <>
                    <span className="text-muted-foreground px-0.5 text-base font-medium">=</span>
                    {result}
                </>
            )}
        </div>
    );
}

/** The `= value` chip closing a formula. */
export function ResultChip({ value }: { value: null | number }) {
    return <span className={cn(CHIP_CLASS, "border-primary/40 bg-primary/10 justify-center font-semibold tabular-nums")}>{fullNumber(value)}</span>;
}

/** A filed value to open: what it is (named in the dialog) and the reference to look it up by. */
export type ValueFilingTarget = { ref: ValueRef; title: string };

/**
 * A formula member's filing, framed at the value: found in the loaded as-reported detailed rows (`rows`), else in one
 * as-reported detailed request of the member's period type (`cik` = the company; null = none can be asked).
 */
export function ValueFilingDialog({ cik, onClose, rows = [], scope, target }: {
    cik: null | string;
    onClose: () => void;
    rows?: ReadonlyArray<V2StatementPeriod>;
    scope?: ReportedLookupScope;
    target: null | ValueFilingTarget;
}) {
    const local = React.useMemo(() => (target ? findValueSource(rows.filter(row => sourceInScope(row.source, scope)), target.ref) : null), [rows, scope, target]);

    const selector = target && !local ? valueLookupOf(target.ref) : null;

    const lookup = useReportedValueLookup(selector ? cik : null, selector, scope);

    const found = local ?? (target && lookup.data ? findValueSource(lookup.data.data, target.ref) : null);

    return (
        <FilingDocumentDialog
            onClose={onClose}
            resolving={{ error: lookup.error, isLoading: lookup.isLoading }}
            target={target ? { accession: found?.accession ?? null, elementId: found?.elementId ?? null, title: target.title } : null}
        />
    );
}

/** A computed value's period filing to open at its table: the filing and the operands that may be filed in it. */
export type PeriodFilingTarget = { accession: string; refs: ReadonlyArray<ValueRef>; title: string };

/** The operand most likely filed in the period's filing: the longest one (a Q4's fiscal year, stated by the 10-K). */
function longestRef(refs: ReadonlyArray<ValueRef>) {
    return refs.reduce<null | ValueRef>((best, ref) => (best === null || (refMonths(ref) ?? 0) > (refMonths(best) ?? 0) ? ref : best), null);
}

/**
 * The filing of a computed value (Q4, TTM, YTD: the filing does not state it) opened at the table it belongs to: an
 * operand filed in the SAME filing with an element (the 10-K's fiscal year for a Q4) — from the loaded rows, else one
 * as-reported detailed request for the longest operand — names the table; it is outlined, no cell marked. No such
 * operand = the filing's top.
 */
export function PeriodFilingDialog({ cik, onClose, rows = [], scope, target }: {
    cik: null | string;
    onClose: () => void;
    rows?: ReadonlyArray<V2StatementPeriod>;
    scope?: ReportedLookupScope;
    target: null | PeriodFilingTarget;
}) {
    const local = React.useMemo(() => {
        if (!target) return null;

        const sorted = [...target.refs].sort((a, b) => (refMonths(b) ?? 0) - (refMonths(a) ?? 0));

        const scopedRows = rows.filter(row => sourceInScope(row.source, scope));

        for (const ref of sorted) {
            const found = findValueSource(scopedRows, ref);

            if (found?.accession === target.accession && found.elementId) return found.elementId;
        }

        return null;
    }, [rows, scope, target]);

    const ref = target && !local ? longestRef(target.refs.filter(candidate => candidate.source === undefined)) : null;

    const selector = ref ? valueLookupOf(ref) : null;

    const lookup = useReportedValueLookup(selector ? cik : null, selector, scope);

    const remote = ref && lookup.data ? findValueSource(lookup.data.data, ref) : null;

    const anchorId = local ?? (remote?.accession === target?.accession ? (remote?.elementId ?? null) : null);

    // While the operand is looked up the filing waits (no jump once the table is known); a failed lookup opens the top.
    const waiting = ref !== null && lookup.isLoading;

    return (
        <FilingDocumentDialog
            onClose={onClose}
            resolving={{ error: null, isLoading: waiting }}
            target={target ? { accession: waiting ? null : target.accession, anchorId, elementId: null, title: target.title } : null}
        />
    );
}
