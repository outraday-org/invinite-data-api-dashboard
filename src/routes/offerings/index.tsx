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
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { useV2OfferingsInfinite } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { IN_PLACE, optionalDay, optionalEnum, optionalText } from "@/lib/url-state";

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
    // The API refuses an industry under 2 characters (400): a shorter `?industry=` reads as none.
    industry: optionalText(80, 2),
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
                toolbarMeta={<V2MetaLine meta={meta} />}
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

    // The filters set (the day range counts once): the bar's "Filters · n" and "Reset filters".
    const activeCount = [search.exemption, search.sold, search.amendment, search.industry, search.from ?? search.to].filter(value => value !== undefined).length;

    // A linked amount outside the presets is offered too (the URL is the state).
    const soldOptions = React.useMemo(
        () => (search.sold !== undefined && !SOLD_OPTIONS.some(option => option.value === String(search.sold))
            ? [...SOLD_OPTIONS, { label: `Sold ≥ $${search.sold}`, value: String(search.sold) }]
            : SOLD_OPTIONS),
        [search.sold],
    );

    return (
        <PageContainer>
            <PageHeader
                description={(
                    <>
                        Form D private offerings of every issuer, newest latest filing first (the SEC&apos;s quarterly data
                        sets). Industry matches the group as filed, e.g. &ldquo;Pooled Investment Fund&rdquo; or
                        &ldquo;Other Technology&rdquo;.
                    </>
                )}
                title="Private offerings"
            />

            <FilterBar activeCount={activeCount} onReset={() => onChange({ amendment: undefined, exemption: undefined, from: undefined, industry: undefined, sold: undefined, to: undefined })}>
                <FilterField label="Exemption">
                    {id => <FilterSelect aria-label="Exemption" className="w-full" id={id} onValueChange={value => onChange({ exemption: value === ANY ? undefined : value })} options={EXEMPTION_OPTIONS} value={search.exemption ?? ANY} />}
                </FilterField>
                <FilterField label="Amount sold">
                    {id => <FilterSelect aria-label="Amount sold" className="w-full" id={id} onValueChange={value => onChange({ sold: value === ANY ? undefined : Number(value) })} options={soldOptions} value={search.sold === undefined ? ANY : String(search.sold)} />}
                </FilterField>
                <FilterField label="Amendment">
                    {id => <FilterSelect aria-label="Amendment" className="w-full" id={id} onValueChange={value => onChange({ amendment: value === ANY ? undefined : value })} options={AMENDMENT_OPTIONS} value={search.amendment ?? ANY} />}
                </FilterField>
                <FilterField label="Industry group">
                    {id => <DebouncedInput aria-label="Industry group" className="w-full" id={id} onCommit={value => onChange({ industry: value.trim().length >= 2 ? value.trim() : undefined })} placeholder="As filed" value={search.industry ?? ""} />}
                </FilterField>
                <FilterField label="Latest filing" span={2}>
                    <DayRange from={search.from} labels={{ from: "Filed from", to: "Filed to" }} onChange={onChange} to={search.to} />
                </FilterField>
            </FilterBar>

            <OfferingsList
                error={list.error}
                hasNextPage={list.hasNextPage}
                isFetchingNextPage={list.isFetchingNextPage}
                isLoading={list.isLoading}
                onLoadMore={() => void list.fetchNextPage()}
                pages={list.data?.pages ?? []}
            />
        </PageContainer>
    );
}
