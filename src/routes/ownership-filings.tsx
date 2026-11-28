import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import type { V2BeneficialOwnershipType } from "@/lib/api/types";
import type { OwnershipFormsSearch, OwnershipFormTab } from "@/lib/sec/ownership-forms";

import { ENTRY_TYPES, MarketAlertEntryPoints } from "@/components/alerts/create-alert-button";
import { DebouncedInput } from "@/components/navigation/debounced-input";
import { CompanyFilter } from "@/components/search/company-filter";
import { BeneficialOwnershipList, InsiderSaleNoticesList } from "@/components/sec/ownership-forms-views";
import { DayRange } from "@/components/ui/day-range";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { Notice } from "@/components/ui/notice";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedButtons } from "@/components/ui/segmented-buttons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useV2BeneficialOwnershipInfinite, useV2InsiderSaleNoticesInfinite } from "@/lib/api/queries";
import { joinCompanyList, parseCompanyList } from "@/lib/company-list";
import { titleHead, WRAPPING_TABS_LIST_CLASS } from "@/lib/layout";
import { ignoredCikTokens } from "@/lib/sec/ownership";
import { beneficialOwnershipRequest, cikListParam, insiderSaleNoticesRequest, OWNERSHIP_FORM_TABS } from "@/lib/sec/ownership-forms";
import { IN_PLACE, optionalCompanyList, optionalDay, optionalEnum, optionalText } from "@/lib/url-state";

/**
 * `?tab=form-144` (default the 13D / 13G tab), `?company=<tickers / CIKs>` (both tabs), `?filer=<CIK list>` (13D / 13G
 * reporting persons), `?owner=<CIK list>` (Form 144 sellers), `?type=activist|passive` and `?chain=full` (13D / 13G:
 * the whole amendment chain, `current=false`), `?from=&to=` (filed days, both tabs).
 */
const ownershipFilingsSearchSchema = z.object({
    chain: optionalEnum(["full"]),
    company: optionalCompanyList(),
    filer: optionalText(600),
    from: optionalDay(),
    owner: optionalText(600),
    tab: optionalEnum(OWNERSHIP_FORM_TABS),
    to: optionalDay(),
    type: optionalEnum(["activist", "passive"] as const satisfies ReadonlyArray<V2BeneficialOwnershipType>),
});

type OwnershipFilingsSearch = z.infer<typeof ownershipFilingsSearchSchema>;

export const Route = createFileRoute("/ownership-filings")({
    component: OwnershipFilingsPage,
    head: () => titleHead("Ownership filings"),
    validateSearch: ownershipFilingsSearchSchema,
});

const ALL = "all";

const TYPE_OPTIONS: Array<{ label: string; value: typeof ALL | V2BeneficialOwnershipType }> = [
    { label: "13D and 13G", value: ALL },
    { label: "Activist (13D)", value: "activist" },
    { label: "Passive (13G)", value: "passive" },
];

const LATEST = "latest";

const CHAIN_OPTIONS: Array<{ label: string; title: string; value: "full" | typeof LATEST }> = [
    { label: "Latest only", title: "The latest filing per company, primary holder and class", value: LATEST },
    { label: "Full amendment chain", title: "Every filing, linked by the filing it follows", value: "full" },
];

/** The note under a CIK filter: nothing valid in it, or the tokens it ignores. */
function CikListNote({ text }: { text: string | undefined }) {
    if (!text) return null;

    if (!cikListParam(text)) return <div className="text-muted-foreground text-xs">No CIK in this list: it is not sent</div>;

    const ignored = ignoredCikTokens(text);

    return ignored.length > 0 ? <div className="text-muted-foreground text-xs">{`Ignored (no CIK): ${ignored.join(", ")}`}</div> : null;
}

/** The state before a request: the API needs a company or a person, so nothing is asked until one is named. */
function PickSubjectNotice({ person }: { person: string }) {
    return (
        <Notice title="Pick a company or enter a CIK">
            {`Choose one or more companies, or enter ${person} CIKs (comma-separated). Both together narrow to that person's filings on those companies.`}
        </Notice>
    );
}

/** The export file's scope word: the company list, else "filer". */
const exportScope = (company: string | undefined) => company?.replaceAll(",", "-") ?? "filer";

/**
 * Ownership filings of listed companies (Data API 11.5, tag Ownership, 1 credit a page): the 13D / 13G tab
 * (`/v1/beneficial-ownership`: holders above 5 % of a class, latest per chain or the whole chain) and the Form 144 tab
 * (`/v1/insider-sale-notices`: notices of a PROPOSED sale). Each tab asks only once a company or a person CIK is named.
 */
function OwnershipFilingsPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<OwnershipFilingsSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const tab: OwnershipFormTab = search.tab ?? "schedule-13";

    const schedules = tab === "schedule-13";

    const state: OwnershipFormsSearch = search;

    // Only the open tab's list is asked (the other hook is idle without a company and a person).
    const beneficialRequest = schedules ? beneficialOwnershipRequest(state) : null;

    const noticesRequest = schedules ? null : insiderSaleNoticesRequest(state);

    const beneficial = useV2BeneficialOwnershipInfinite(beneficialRequest ?? {});

    const notices = useV2InsiderSaleNoticesInfinite(noticesRequest ?? {});

    const person = schedules ? search.filer : search.owner;

    // The day range counts once; the 13D / 13G filters count on their tab only.
    const activeCount = [search.company, person, search.from ?? search.to, ...(schedules ? [search.type, search.chain] : [])].filter(Boolean).length;

    const onReset = () => onChange({ chain: undefined, company: undefined, filer: undefined, from: undefined, owner: undefined, to: undefined, type: undefined });

    return (
        <PageContainer>
            <PageHeader
                actions={<MarketAlertEntryPoints types={ENTRY_TYPES.ownership} />}
                description={(
                    <>
                        Schedule 13D (activist) and 13G (passive) filings of holders above 5 % of a class of a listed company,
                        and Form 144 notices of a proposed insider sale. Newest filed first.
                    </>
                )}
                title="Ownership filings"
            />

            <Tabs className="gap-4" onValueChange={value => onChange({ tab: value === "form-144" ? "form-144" : undefined })} value={tab}>
                <TabsList aria-label="Ownership form" className={WRAPPING_TABS_LIST_CLASS} variant="line">
                    <TabsTrigger value="schedule-13">13D / 13G</TabsTrigger>
                    <TabsTrigger value="form-144">Form 144</TabsTrigger>
                </TabsList>

                <FilterBar activeCount={activeCount} onReset={onReset}>
                    <FilterField label="Companies" span={2}>
                        {id => <CompanyFilter id={id} onChange={companies => onChange({ company: joinCompanyList(companies) })} value={parseCompanyList(search.company)} />}
                    </FilterField>
                    {schedules
                        ? (
                                <FilterField label="Filer CIKs">
                                    {id => <DebouncedInput aria-label="Filer CIKs" className="w-full" id={id} onCommit={value => onChange({ filer: value.trim() || undefined })} placeholder="Reporting-person CIK(s)" value={search.filer ?? ""} />}
                                </FilterField>
                            )
                        : (
                                <FilterField label="Seller CIKs">
                                    {id => <DebouncedInput aria-label="Seller CIKs" className="w-full" id={id} onCommit={value => onChange({ owner: value.trim() || undefined })} placeholder="Seller CIK(s)" value={search.owner ?? ""} />}
                                </FilterField>
                            )}
                    {schedules && (
                        <FilterField label="Type">
                            {id => <FilterSelect aria-label="Type" className="w-full" id={id} onValueChange={value => onChange({ type: value === ALL ? undefined : value })} options={TYPE_OPTIONS} value={search.type ?? ALL} />}
                        </FilterField>
                    )}
                    {schedules && (
                        <FilterField label="Filings" span={2}>
                            <SegmentedButtons aria-label="Filings" onChange={value => onChange({ chain: value === "full" ? "full" : undefined })} options={CHAIN_OPTIONS} value={search.chain ?? LATEST} />
                        </FilterField>
                    )}
                    <FilterField label="Filed" span={2}>
                        <DayRange from={search.from} labels={{ from: "Filed from", to: "Filed to" }} onChange={onChange} to={search.to} />
                    </FilterField>
                </FilterBar>

                <CikListNote text={person} />

                <TabsContent value="schedule-13">
                    {beneficialRequest
                        ? (
                                <BeneficialOwnershipList
                                    error={beneficial.error}
                                    exportScope={exportScope(search.company)}
                                    hasNextPage={beneficial.hasNextPage}
                                    isFetchingNextPage={beneficial.isFetchingNextPage}
                                    isLoading={beneficial.isLoading}
                                    onLoadMore={() => void beneficial.fetchNextPage()}
                                    pages={beneficial.data?.pages ?? []}
                                />
                            )
                        : <PickSubjectNotice person="reporting-person" />}
                </TabsContent>

                <TabsContent value="form-144">
                    <p className="text-muted-foreground mb-2 text-sm" data-testid="form-144-note">
                        A Form 144 notice announces a proposed sale of restricted or control securities: it is not an executed
                        trade (the sale itself is reported on Form 4, see a company&apos;s insider trades).
                    </p>
                    {noticesRequest
                        ? (
                                <InsiderSaleNoticesList
                                    error={notices.error}
                                    exportScope={exportScope(search.company)}
                                    hasNextPage={notices.hasNextPage}
                                    isFetchingNextPage={notices.isFetchingNextPage}
                                    isLoading={notices.isLoading}
                                    onLoadMore={() => void notices.fetchNextPage()}
                                    pages={notices.data?.pages ?? []}
                                />
                            )
                        : <PickSubjectNotice person="seller" />}
                </TabsContent>
            </Tabs>
        </PageContainer>
    );
}
