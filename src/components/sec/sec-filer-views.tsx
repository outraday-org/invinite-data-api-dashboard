import { FileText } from "lucide-react";

import type { JsonValue, SecFilerResponse, SecFilingsResponse, SecLifecycleResponse, SecManagerPortfolioResponse } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isGenuineEmpty } from "@/lib/sec/readiness";
import { listOf, recordOf, reviewStatusOf, scalarEntries, textOf } from "@/lib/sec/source";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

import type { SecPanelTarget } from "./sec-source-panel";

import { SecReadinessNotice } from "./sec-readiness-notice";

function Facts({ entries }: { entries: Array<[string, string]> }) {
    if (entries.length === 0) return null;

    return (
        <dl className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {entries.map(([key, value]) => (
                <div className="flex gap-1" key={key}>
                    <dt>{`${key}:`}</dt>
                    <dd className="text-foreground">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

/** The filer's identity (pure): name, CIK, SEC-stated tickers (or none — a pre-IPO issuer, a SPAC, a manager). */
export function SecFilerHeader({ cik, data, error, isLoading }: { cik: string; data: null | SecFilerResponse; error: unknown; isLoading: boolean }) {
    if (error) return <SecReadinessNotice error={error} title="Failed to load the filer" />;

    if (isLoading && !data) return <Skeleton className="h-12 w-full" />;

    const filer = recordOf(data?.filer);

    const tickers = listOf(filer.stated_tickers).filter(item => typeof item === "string");

    return (
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold">{textOf(filer, "name") ?? `CIK ${cik}`}</h1>
                <span className="text-muted-foreground text-sm tabular-nums">{`CIK ${textOf(filer, "cik10") ?? cik}`}</span>
                {tickers.length > 0
                    ? tickers.map(ticker => <Badge key={ticker} variant="secondary">{ticker}</Badge>)
                    : <Badge variant="outline">No ticker</Badge>}
            </div>
            {tickers.length > 0 && (
                <div className="text-muted-foreground text-xs">Tickers as stated to the SEC by the filer, not a verified listing.</div>
            )}
            {data && <SecReadinessNotice readiness={data.readiness} />}
        </div>
    );
}

function RecordList({ empty, items, title }: { empty: string; items: ReadonlyArray<JsonValue>; title: string }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="text-sm font-medium">{title}</div>
            {items.length === 0
                ? <div className="text-muted-foreground text-xs">{empty}</div>
                : (
                        <ul className="flex flex-col gap-1">
                            {items.map((item, index) => (
                                // Free-form rows without an id of their own; their order is the API's.
                                <li className="rounded-md border p-2" key={index}>
                                    <div className="mb-1">
                                        <Badge variant="outline">{`Review status: ${reviewStatusOf(item) ?? "not stated"}`}</Badge>
                                    </div>
                                    <Facts entries={scalarEntries(item, ["status", "review_status"])} />
                                </li>
                            ))}
                        </ul>
                    )}
        </div>
    );
}

/**
 * The issuer lifecycle (pure): the eligibility decision, the issuer phase, registration tracks and successor evidence,
 * each with its review status stated (never assumed). A refused / not switched-on lifecycle is its notice.
 */
export function SecLifecycleView({ data, error, isLoading }: { data: null | SecLifecycleResponse; error: unknown; isLoading: boolean }) {
    if (error) return <SecReadinessNotice error={error} title="Failed to load the issuer lifecycle" />;

    if (isLoading && !data) return <Skeleton className="h-24 w-full" />;

    if (!data) return null;

    const successions = listOf(recordOf(data.successions).relations);

    return (
        <section aria-label="Issuer lifecycle" className="flex flex-col gap-3">
            <SecReadinessNotice readiness={data.readiness} />
            {data.decision && (
                <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium">Decision</div>
                    <Facts entries={scalarEntries(data.decision)} />
                </div>
            )}
            {data.issuer && (
                <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium">Issuer</div>
                    <Facts entries={scalarEntries(data.issuer)} />
                </div>
            )}
            <RecordList empty="No registration track." items={data.registration_tracks ?? []} title="Registration tracks" />
            <RecordList empty="No successor evidence." items={successions} title="Successor evidence" />
            {(data.warnings ?? []).length > 0 && (
                <div className="text-muted-foreground flex flex-col text-xs" role="status">
                    {(data.warnings ?? []).map(warning => <span key={warning}>{warning.replaceAll("_", " ")}</span>)}
                </div>
            )}
        </section>
    );
}

/**
 * A filer's filings (pure): every loaded cursor page, the `form_facet` filter, a row opens the accession's documents
 * in the source panel; `withheld` counts are said, and "No filings" only for a ready answer.
 */
export function SecFilingsView({
    error,
    form,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onFormChange,
    onMore,
    onOpen,
    pages,
}: {
    error: unknown;
    form: null | string;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onFormChange: (form: null | string) => void;
    onMore: () => void;
    onOpen: (target: SecPanelTarget) => void;
    pages: ReadonlyArray<SecFilingsResponse>;
}) {
    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the filings" />;

    if (isLoading && pages.length === 0) return <Skeleton className="h-40 w-full" />;

    const first = pages.at(0);

    if (!first) return null;

    const filings = pages.flatMap(page => page.filings ?? []);

    const facet = first.form_facet ?? [];

    const withheld = scalarEntries(first.withheld).filter(([, value]) => value !== "0");

    const options = [
        { label: "All forms", value: "all" },
        ...facet.flatMap(entry => (entry.form ? [{ label: `${entry.form} (${entry.count ?? 0})`, value: entry.form }] : [])),
    ];

    return (
        <section aria-label="Filings" className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <FilterSelect className="w-[200px]" onValueChange={value => onFormChange(value === "all" ? null : value)} options={options} value={form ?? "all"} />
                {withheld.length > 0 && (
                    <span className="text-muted-foreground text-xs">{`Withheld: ${withheld.map(([key, value]) => `${value} ${key}`).join(", ")}`}</span>
                )}
            </div>
            <SecReadinessNotice readiness={pages.at(-1)?.readiness} />
            {filings.length === 0
                ? (isGenuineEmpty(first.readiness) && <div className="text-muted-foreground text-xs">No filings.</div>)
                : (
                        <table className="w-full text-xs">
                            <thead className="text-muted-foreground text-left">
                                <tr>
                                    <th className="p-1 font-normal">Form</th>
                                    <th className="p-1 font-normal">Filed</th>
                                    <th className="p-1 font-normal">Period</th>
                                    <th className="p-1 font-normal">Accession</th>
                                    <th className="p-1 font-normal">Roles</th>
                                    <th className="p-1" />
                                </tr>
                            </thead>
                            <tbody>
                                {filings.map((filing) => {
                                    const { accession } = filing;

                                    if (!accession) return null;

                                    return (
                                        <tr key={accession}>
                                            <td className="p-1 font-medium">{filing.form ?? "—"}</td>
                                            <td className="p-1">{filing.filing_date ?? "—"}</td>
                                            <td className="p-1">{filing.report_date ?? "—"}</td>
                                            <td className="p-1 tabular-nums">{accession}</td>
                                            <td className="p-1">{(filing.roles ?? []).join(", ") || "—"}</td>
                                            <td className="flex items-center justify-end gap-2 p-1">
                                                {filing.edgar_index_url?.startsWith("https://www.sec.gov/") && (
                                                    <a className="underline-offset-4 hover:underline" href={filing.edgar_index_url} rel="noopener noreferrer" target="_blank">
                                                        EDGAR
                                                    </a>
                                                )}
                                                <Button
                                                    onClick={() => onOpen({ accession, kind: "filing", title: `${filing.form ?? "Filing"} · ${accession}` })}
                                                    size="xs"
                                                    type="button"
                                                    variant="outline"
                                                >
                                                    <FileText />
                                                    Documents
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
            {error ? <SecReadinessNotice error={error} title="Failed to load more filings" /> : null}
            {hasNextPage && (
                <Button className="self-center" disabled={isFetchingNextPage} onClick={onMore} size="sm" type="button" variant="outline">
                    {isFetchingNextPage ? "Loading…" : "More filings"}
                </Button>
            )}
        </section>
    );
}

/** A 13F manager's portfolio page with its provenance: `pinned_at`, `page_status`, `coverage` (pure). */
export function SecPortfolioView({ data, error, isLoading }: { data: null | SecManagerPortfolioResponse; error: unknown; isLoading: boolean }) {
    if (error) return <SecReadinessNotice error={error} title="Failed to load the 13F portfolio" />;

    if (isLoading && !data) return <Skeleton className="h-24 w-full" />;

    if (!data) return null;

    const rows = data.rows ?? [];

    return (
        <section aria-label="13F portfolio" className="flex flex-col gap-2">
            <SecReadinessNotice readiness={data.readiness} />
            <Facts
                entries={[
                    ["pinned at", data.pinned_at ?? "—"],
                    ["page status", data.page_status ?? "—"],
                    ["counting policy", data.counting_policy ?? "—"],
                    ...scalarEntries(data.coverage).map(([key, value]): [string, string] => [`coverage ${key}`, value]),
                ]}
            />
            {(data.disclosure_limitations ?? []).length > 0 && (
                <div className="text-muted-foreground text-xs">{(data.disclosure_limitations ?? []).join(" · ")}</div>
            )}
            {rows.length === 0
                ? <div className="text-muted-foreground text-xs">{data.page_status === "complete_empty" ? "The manager reported no positions." : "No rows on this page."}</div>
                : (
                        <ul className="flex flex-col gap-1">
                            {rows.map((row, index) => (
                                // Rows carry no id of their own; the API orders them.
                                <li className="rounded-md border p-2" key={index}><Facts entries={scalarEntries(row)} /></li>
                            ))}
                        </ul>
                    )}
        </section>
    );
}
