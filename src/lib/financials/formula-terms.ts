/**
 * A computed value's formula as terms to render: operators and parentheses as stated, every operand matched to the
 * formula's members (by concept and period for a raw fact id, else by position when the counts agree), so each one can
 * render as a chip with its own period and value.
 */
import type { ValueRef } from "./value-ref";

import { localConcept, refOfFactId } from "./value-ref";

export type FormulaTerm
    = | { kind: "operand"; member: null | number; ref: null | ValueRef; text: string }
        | { kind: "operator"; text: string }
        | { kind: "paren"; text: string };

/** An operator as printed ("-" → "−", "*" → "×", "/" → "÷"). */
const OPERATOR_TEXT: Record<string, string> = { "*": "×", "+": "+", "-": "−", "/": "÷", "×": "×", "−": "−" };

/** Operators count only between spaces: a raw fact id holds dashes (`2025-09-28`, `|-|-`). */
const OPERATOR_SPLIT = /(\s+[-+*/×−]\s+)/u;

export const sameRef = (a: ValueRef, b: ValueRef) =>
    localConcept(a.concept) === localConcept(b.concept) && a.start === b.start && a.end === b.end && a.instant === b.instant;

/** One operand piece with its leading "(" and trailing ")" split off. */
function operandPieces(piece: string): Array<FormulaTerm> {
    const terms: Array<FormulaTerm> = [];

    let text = piece.trim();

    while (text.startsWith("(")) {
        terms.push({ kind: "paren", text: "(" });

        text = text.slice(1).trim();
    }

    let closing = 0;

    while (text.endsWith(")")) {
        closing += 1;

        text = text.slice(0, -1).trim();
    }

    if (text) terms.push({ kind: "operand", member: null, ref: refOfFactId(text), text });

    for (let index = 0; index < closing; index += 1) terms.push({ kind: "paren", text: ")" });

    return terms;
}

/**
 * The terms of `formula`; `members` = the formula's operands in their stated order (null = a member that names no
 * filed value, e.g. a standardized metric). An operand matches the member with the same concept and period; when no
 * operand is a raw fact id ("FY - Q1 - Q2 - Q3") and the counts agree, the n-th operand is the n-th member.
 */
export function formulaTerms(formula: string, members: ReadonlyArray<null | ValueRef>): Array<FormulaTerm> {
    const terms = formula
        .split(OPERATOR_SPLIT)
        .flatMap<FormulaTerm>((piece) => {
            if (OPERATOR_SPLIT.test(piece) || /^\s*[-+*/×−]\s*$/u.test(piece)) {
                const operator = piece.trim();

                return [{ kind: "operator", text: OPERATOR_TEXT[operator] ?? operator }];
            }

            return operandPieces(piece);
        });

    const operands = terms.filter(term => term.kind === "operand");

    const used = new Set<number>();

    for (const operand of operands) {
        if (!operand.ref) continue;

        const index = members.findIndex((member, position) => member !== null && !used.has(position) && sameRef(member, operand.ref!));

        if (index >= 0) {
            used.add(index);

            operand.member = index;
        }
    }

    if (used.size === 0 && operands.length === members.length) {
        operands.forEach((operand, index) => {
            operand.member = index;
        });
    }

    return terms;
}
