import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import * as React from "react";

import type { V2FilersResponse } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2Filers } from "@/lib/api/queries";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";

import { PHASE_LABELS } from "./sec-filer-views";
import { SecReadinessNotice } from "./sec-readiness-notice";

const CIK_PATTERN = /^\d{1,10}$/;

/** A typed CIK goes straight to its page (leading zeros dropped); anything else is a name search. */
export function cikOf(input: string): null | string {
    const trimmed = input.trim();

    return CIK_PATTERN.test(trimmed) && Number(trimmed) > 0 ? String(Number(trimmed)) : null;
}

/** The name matches (pure): each opens `/sec/$cik` — a filer without a ticker included, never a fake `$ticker`. */
export function SecFilerMatches({ data, error, isLoading }: { data: null | V2FilersResponse; error: unknown; isLoading: boolean }) {
    if (error) return <SecReadinessNotice error={error} title="Filer lookup failed" />;

    if (isLoading && !data) return <Skeleton className="h-16 w-full" />;

    if (!data) return null;

    const matches = data.data;

    return (
        <div className="flex flex-col gap-2">
            <SecReadinessNotice coverage={data.meta.coverage} />
            {matches.length === 0
                ? (isV2GenuineEmpty(data.meta.coverage) && <div className="text-muted-foreground text-xs">No SEC filer matches this name.</div>)
                : (
                        <ul className="flex flex-col gap-1">
                            {matches.map((match) => {
                                // The registry pads the CIK to 10 digits; the page URL takes it without the zeros.
                                const cik = cikOf(match.cik);

                                if (!cik) return null;

                                const tickers = match.listing ? [match.listing.ticker] : match.stated_tickers;

                                return (
                                    <li className="flex flex-wrap items-center gap-2 text-sm" key={cik}>
                                        <Link className="font-medium underline-offset-4 hover:underline" params={{ cik }} to="/sec/$cik">
                                            {match.name || `CIK ${cik}`}
                                        </Link>
                                        <span className="text-muted-foreground text-xs tabular-nums">{`CIK ${cik}`}</span>
                                        {tickers.length > 0
                                            ? tickers.map(ticker => <Badge key={ticker} variant="secondary">{ticker}</Badge>)
                                            : <Badge variant="outline">No ticker</Badge>}
                                        {match.entity_type && <span className="text-muted-foreground text-xs">{match.entity_type}</span>}
                                        {match.phase && <Badge variant="outline">{PHASE_LABELS[match.phase]}</Badge>}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
        </div>
    );
}

/**
 * Find an SEC filer by CIK or name (`/v1/filers?q=`, one page of ≤ 50): pre-IPO issuers, SPACs and 13F managers without an
 * exchange listing are reachable here, outside the `$ticker` pages.
 */
export function SecFilerLookup() {
    const navigate = useNavigate();

    const [draft, setDraft] = React.useState("");

    const [name, setName] = React.useState("");

    const { data, error, isFetching } = useV2Filers({ limit: 20, q: name });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        const cik = cikOf(draft);

        if (cik) {
            void navigate({ params: { cik }, to: "/sec/$cik" });

            return;
        }

        if (draft.trim().length >= 2) setName(draft.trim());
    };

    return (
        <section className="flex flex-col gap-2">
            <form className="flex items-center gap-2" onSubmit={submit}>
                <Input
                    aria-label="SEC filer CIK or name"
                    maxLength={200}
                    onChange={event => setDraft(event.target.value)}
                    placeholder="CIK or company / manager name — e.g. 320193 or Berkshire"
                    value={draft}
                />
                <Button disabled={draft.trim().length < 1 || isFetching} type="submit">
                    <Search />
                    Find filer
                </Button>
            </form>
            {name && <SecFilerMatches data={data} error={error} isLoading={isFetching} />}
        </section>
    );
}
