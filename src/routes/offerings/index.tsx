import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { V2OfferingsResponse } from "@/lib/api/types";

import { DebouncedInput } from "@/components/navigation/debounced-input";
import { exemptionLabel, offeringColumns } from "@/components/sec/sec-filer-views";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { V2MetaLine } from "@/components/sec/v2-meta-line";
import { DataTable } from "@/components/ui/data-table";
import { DayRange } from "@/components/ui/day-range";
import { PageHeader } from "@/components/ui/page-header";
import { useV2OfferingsInfinite } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { IN_PLACE, optionalDay, optionalEnum, optionalText } from "@/lib/url-state";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

/** Exemptions the picker offers (as filed; the API takes any code matching `^[A-Za-z0-9.()]{1,12}$`). */
const EXEMPTION_CODES = ["06b", "06c", "04", "4a5", "3C", "3C.1", "3C.7"] as const;

/** Minimum amounts sold the picker offers (USD, `total_sold.gte`). */
const MIN_SOLD_OPTIONS = [1_000_000, 10_000_000, 100_000_000, 1_000_000_000] as const;

/**
 * `?from=&to=` (latest filing days), `?exemption=` (as filed), `?industry=` (industry group as filed, exact),
 * `?sold=<USD>` (at least this much sold), `?amendment=original|amendment`. One order: newest latest filing first.
 */
const offeringsSearchSchema = z.object({
    amendment: optionalEnum(["original", "amendment"]),
    exemption: optionalEnum(EXEMPTION_CODES),
    from: optionalDay(),
    industry: optionalText(80),
    sold: z.coerce.number().int().min(0).max(1e15).optional().catch(undefined),
    to: optionalDay(),
});

type OfferingsSearch = z.infer<typeof offeringsSearchSchema>;

export const Route = createFileRoute("/offerings/")({
    component: OfferingsPage,
    head: () => titleHead("Private offerings"),
    validateSearch: offeringsSearchSchema,
});

/** Offerings per page (the API allows up to 200). */
const OFFERINGS_PAGE = 50;

const ANY = "any";

type Exemption = (typeof EXEMPTION_CODES)[number];

const EXEMPTION_OPTIONS: Array<{ label: string; value: Exemption | typeof ANY }> = [
    { label: "Any exemption", value: ANY },
    ...EXEMPTION_CODES.map(code => ({ label: exemptionLabel(code), value: code })),
];

const SOLD_OPTIONS = [
    { label: "Any amount sold", value: ANY },
    ...MIN_SOLD_OPTIONS.map(amount => ({ label: `Sold ≥ $${new Intl.NumberFormat("en", { notation: "compact" }).format(amount)}`, value: String(amount) })),
];

const AMENDMENT_OPTIONS: Array<{ label: string; value: "amendment" | "original" | typeof ANY }> = [
    { label: "Originals and amendments", value: ANY },
    { label: "Latest filing an original", value: "original" },
    { label: "Latest filing an amendment", value: "amendment" },
];

const MARKET_COLUMNS = offeringColumns({ issuer: true });

/** The market-wide offerings list (pure): the request's state, the coverage, the rows, "Load more", export. */
export function OfferingsList({ error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages }: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<V2OfferingsResponse>;
}) {
    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the offerings" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2">
            <SecReadinessNotice coverage={meta?.coverage} />
            <V2MetaLine meta={meta} />
            <DataTable
                columns={MARKET_COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText="No offering matches these filters."
                exportConfig={{ dataset: "offerings", scope: "all" }}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listOfferings"
                rows={pages.flatMap(page => page.data)}
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load more offerings" /> : null}
        </div>
    );
}

/**
 * Every Form D private offering (`GET /v1/offerings` without `company`, 1 credit a page): newest latest filing first,
 * filtered by latest filing day, exemption, industry group, amount sold and amendment — all in the URL. An offering
 * opens `/offerings/$offeringId`, its issuer `/sec/$cik`.
 */
function OfferingsPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<OfferingsSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const list = useV2OfferingsInfinite({
        exemption: search.exemption,
        filedFrom: search.from,
        filedTo: search.to,
        industry: search.industry,
        isAmendment: search.amendment ? search.amendment === "amendment" : undefined,
        limit: OFFERINGS_PAGE,
        totalSoldGte: search.sold,
    });

    // A linked amount outside the presets is offered too (the URL is the state).
    const soldOptions = React.useMemo(
        () => (search.sold !== undefined && !SOLD_OPTIONS.some(option => option.value === String(search.sold))
            ? [...SOLD_OPTIONS, { label: `Sold ≥ $${search.sold}`, value: String(search.sold) }]
            : SOLD_OPTIONS),
        [search.sold],
    );

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:px-8">
            <PageHeader
                actions={(
                    <>
                        <FilterSelect aria-label="Exemption" className="w-[170px]" onValueChange={value => onChange({ exemption: value === ANY ? undefined : value })} options={EXEMPTION_OPTIONS} value={search.exemption ?? ANY} />
                        <FilterSelect aria-label="Amount sold" className="w-[170px]" onValueChange={value => onChange({ sold: value === ANY ? undefined : Number(value) })} options={soldOptions} value={search.sold === undefined ? ANY : String(search.sold)} />
                        <FilterSelect aria-label="Amendment" className="w-[210px]" onValueChange={value => onChange({ amendment: value === ANY ? undefined : value })} options={AMENDMENT_OPTIONS} value={search.amendment ?? ANY} />
                        <DebouncedInput aria-label="Industry group" className="w-[220px]" onCommit={value => onChange({ industry: value.trim().length >= 2 ? value.trim() : undefined })} placeholder="Industry, as filed" value={search.industry ?? ""} />
                        <DayRange from={search.from} group labels={{ from: "Filed from", to: "Filed to" }} lead="Filed" onChange={onChange} to={search.to} />
                    </>
                )}
                description={(
                    <>
                        Form D private offerings of every issuer, newest latest filing first (the SEC&apos;s quarterly data
                        sets). Industry matches the group as filed, e.g. &ldquo;Pooled Investment Fund&rdquo; or
                        &ldquo;Other Technology&rdquo;.
                    </>
                )}
                title="Private offerings"
            />

            <OfferingsList
                error={list.error}
                hasNextPage={list.hasNextPage}
                isFetchingNextPage={list.isFetchingNextPage}
                isLoading={list.isLoading}
                onLoadMore={() => void list.fetchNextPage()}
                pages={list.data?.pages ?? []}
            />
        </div>
    );
}
