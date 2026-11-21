import type * as React from "react";

import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

/** A security as a holdings row states it (a fund position, a manager's portfolio row). */
export type HeldSecurity = { cik?: null | string; name?: null | string; symbol?: null | string };

/** The `/sec/$cik` parameter of a stated CIK (unpadded), null when it is none. */
export function filerCikParam(cik: null | string | undefined) {
    return cik && /^\d{1,10}$/.test(cik) && Number(cik) > 0 ? String(Number(cik)) : null;
}

/**
 * The held security: its instrument page when the row states a ticker (as stated by the source: an unknown one renders
 * the instrument page's "not a known instrument" notice; no row is checked with a request), else its issuer's filer
 * page when the issuer resolved to a CIK, else plain text.
 */
export function SecurityLink({ children, className, security }: { children: React.ReactNode; className?: string; security: HeldSecurity }) {
    const linkClass = cn("underline-offset-4 hover:underline", className);

    if (security.symbol) {
        return <Link className={linkClass} params={{ ticker: security.symbol }} title={`Open ${security.symbol}`} to="/$ticker">{children}</Link>;
    }

    const cik = filerCikParam(security.cik);

    if (cik) return <Link className={linkClass} params={{ cik }} title={`The issuer's SEC filer page (CIK ${cik})`} to="/sec/$cik">{children}</Link>;

    return <span className={className}>{children}</span>;
}
