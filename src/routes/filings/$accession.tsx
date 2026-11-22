import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { z } from "zod";

import type { V2ReviewDirection, V2SectionOutline } from "@/lib/api/types";

import { DebouncedInput } from "@/components/navigation/debounced-input";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { V2DocumentReader, V2FilingDocumentsView } from "@/components/sec/sec-source-panel";
import { filerCikParam } from "@/components/sec/security-link";
import { Button } from "@/components/ui/button";
import { Copyable } from "@/components/ui/copy-button";
import { PlanBadge } from "@/components/ui/credit-hint";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listState } from "@/lib/api/list-state";
import {
    useV2DocumentSectionsInfinite,
    useV2FactPlacesInfinite,
    useV2Filing,
    useV2FilingFactsInfinite,
    useV2FilingHoldingsInfinite,
    useV2FilingNotesInfinite,
    useV2ReviewChain,
} from "@/lib/api/queries";
import { formatDay, formatInstant } from "@/lib/format";
import { titleHead } from "@/lib/layout";
import { isAccessionParam, toV2FilingDocuments } from "@/lib/sec/source";
import { IN_PLACE, optionalEnum, optionalInt, optionalText } from "@/lib/url-state";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

import {
    DocumentSectionsView,
    FactPlacesView,
    FilingFactsView,
    FilingHoldingsView,
    FilingNotesView,
    FilingPartiesView,
    hasFiledHoldings,
    ReviewChainView,
} from "./-components/filing-detail-views";

const TABS = ["facts", "notes", "review", "holdings", "parties"] as const;

type Tab = "documents" | (typeof TABS)[number];

/**
 * `?tab=` (Documents by default), `?version=<uuid>` (a document version opened below the documents) with `?panel=`
 * (`sections` | `places`; the reader by default), `?block=` (the reader's focus) and `?outline=legacy`; `?tag=` (facts'
 * concepts), `?noteTag=` (notes' concepts), `?depth=` (review-chain hops, 1 by default) and `?direction=`.
 */
const filingSearchSchema = z.object({
    block: z.string().regex(/^b\d+$/).optional().catch(undefined),
    depth: optionalInt(2, 6),
    direction: optionalEnum(["up", "down"]),
    noteTag: optionalText(500),
    outline: optionalEnum(["legacy"]),
    panel: optionalEnum(["sections", "places"]),
    tab: optionalEnum(TABS),
    tag: optionalText(500),
    version: z.uuid().optional().catch(undefined),
});

type FilingSearch = z.infer<typeof filingSearchSchema>;

export const Route = createFileRoute("/filings/$accession")({
    component: FilingPage,
    head: ({ params }) => titleHead(params.accession, "Filing"),
    validateSearch: filingSearchSchema,
});

const linkClass = "text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline";

/**
 * One SEC filing (`/v1/filings/{accession}?expand=documents`): its documents (+ a version's reader, sections and fact
 * places), facts, notes, review chain, reported holdings (13F-HR / NPORT-P only) and parties & relations. Each tab asks
 * its operation only while open.
 */
function FilingPage() {
    const { accession } = Route.useParams();

    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: FilingSearch) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const validAccession = isAccessionParam(accession);

    // A malformed accession asks nothing (the server function would refuse it with a validation dump, F044).
    const filing = useV2Filing(validAccession ? accession : null, ["documents"]);

    const data = filing.data;

    const showHoldings = hasFiledHoldings(data?.form);

    const requested: Tab = search.tab ?? "documents";

    // A `?tab=holdings` of a filing without reported lines falls back to its documents.
    const tab: Tab = requested === "holdings" && data && !showHoldings ? "documents" : requested;

    const ticker = data?.company.ticker ?? null;

    const cik = filerCikParam(data?.company.cik);

    const title = data ? [data.form, ticker ?? (cik ? `CIK ${cik}` : null)].filter(Boolean).join(" · ") : accession;

    const description = data
        ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Copyable label="Copy accession number" value={accession} />
                    <span>{`Filed ${formatDay(data.filing_date)}`}</span>
                    {data.filed_at && <span>{`Accepted ${formatInstant(data.filed_at)}`}</span>}
                    {data.report_date && <span>{`Period ${formatDay(data.report_date)}`}</span>}
                    {data.items.length > 0 && <span>{`Items ${data.items.join(", ")}`}</span>}
                    {ticker && <Link className={linkClass} params={{ ticker }} to="/$ticker/filings">{`${ticker} filings`}</Link>}
                    {cik && <Link className={linkClass} params={{ cik }} to="/sec/$cik">{`Filer ${cik}`}</Link>}
                    {data.edgar_index_url.startsWith("https://www.sec.gov/") && (
                        // An outbound link to EDGAR; this app never fetches sec.gov.
                        <a className={linkClass} href={data.edgar_index_url} rel="noopener noreferrer" target="_blank">
                            EDGAR index
                            <ExternalLink className="size-3" />
                        </a>
                    )}
                </div>
            )
        : "An SEC filing: documents, facts, notes, review chain, holdings and parties.";

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:px-8">
            <PageHeader description={description} title={title} />

            {!validAccession
                ? (
                        <Notice badge="Not found" title={`${accession} is not an accession number`}>
                            An accession number reads 0000320193-26-000026 (10 digits, 2, 6) or as its 18 digits.
                        </Notice>
                    )
                : filing.error
                    ? <SecReadinessNotice error={filing.error} title="Failed to load the filing" />
                    : (
                            <Tabs onValueChange={value => onChange({ tab: value === "documents" ? undefined : value as FilingSearch["tab"] })} value={tab}>
                                <div className="max-w-full overflow-x-auto">
                                    <TabsList variant="line">
                                        <TabsTrigger className="h-[34px]" value="documents">Documents</TabsTrigger>
                                        <TabsTrigger className="h-[34px]" value="facts">Facts</TabsTrigger>
                                        <TabsTrigger className="h-[34px]" value="notes">Notes</TabsTrigger>
                                        <TabsTrigger className="h-[34px]" value="review">Review chain</TabsTrigger>
                                        {showHoldings && <TabsTrigger className="h-[34px]" value="holdings">Holdings</TabsTrigger>}
                                        <TabsTrigger className="h-[34px]" value="parties">Parties & relations</TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent className="mt-2" value="documents">
                                    <DocumentsTab accession={accession} onChange={onChange} search={search} />
                                </TabsContent>
                                <TabsContent className="mt-2" value="facts">
                                    {tab === "facts" && <FactsTab accession={accession} onTag={tag => onChange({ tag: tag.trim() || undefined })} tag={search.tag} />}
                                </TabsContent>
                                <TabsContent className="mt-2" value="notes">
                                    {tab === "notes" && <NotesTab accession={accession} onTag={tag => onChange({ noteTag: tag.trim() || undefined })} tag={search.noteTag} />}
                                </TabsContent>
                                <TabsContent className="mt-2" value="review">
                                    {tab === "review" && <ReviewTab accession={accession} depth={search.depth ?? 1} direction={search.direction ?? "both"} onChange={onChange} />}
                                </TabsContent>
                                {showHoldings && (
                                    <TabsContent className="mt-2" value="holdings">
                                        {tab === "holdings" && <HoldingsTab accession={accession} />}
                                    </TabsContent>
                                )}
                                <TabsContent className="mt-2" value="parties">
                                    {tab === "parties" && <PartiesTab accession={accession} />}
                                </TabsContent>
                            </Tabs>
                        )}
        </div>
    );
}

/** The open version (its reader, sections or fact places) above the documents (the header's request, cached). */
function DocumentsTab({ accession, onChange, search }: { accession: string; onChange: (patch: FilingSearch) => void; search: FilingSearch }) {
    const filing = useV2Filing(accession, ["documents"]);

    const documents = toV2FilingDocuments(filing.data?.documents);

    const open = search.version ? documents.find(doc => doc.currentVersionId === search.version) : undefined;

    const openVersion = (version: string, panel?: FilingSearch["panel"]) => onChange({ block: undefined, outline: undefined, panel, version });

    const onOpenBlock = (block: string) => onChange({ block, panel: undefined });

    return (
        <div className="flex flex-col gap-4">
            {search.version && (
                <section aria-label="Open document" className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{open?.filename ?? `Version ${search.version}`}</span>
                        {(["read", "sections", "places"] as const).map((panel) => {
                            const active = (search.panel ?? "read") === panel;

                            return (
                                <Button
                                    aria-pressed={active}
                                    key={panel}
                                    onClick={() => onChange({ panel: panel === "read" ? undefined : panel })}
                                    size="xs"
                                    type="button"
                                    variant={active ? "secondary" : "outline"}
                                >
                                    {panel === "read" ? "Text" : panel === "sections" ? "Sections" : "Fact places"}
                                </Button>
                            );
                        })}
                        {search.panel === "places" && <PlanBadge operationId="listFactPlaces" />}
                        <Button className="ml-auto" onClick={() => onChange({ block: undefined, outline: undefined, panel: undefined, version: undefined })} size="xs" type="button" variant="ghost">
                            Close
                        </Button>
                    </div>
                    {search.panel === "sections" && (
                        <SectionsPanel
                            onOpenBlock={onOpenBlock}
                            onOutline={outline => onChange({ outline: outline === "generic" ? undefined : outline })}
                            outline={search.outline ?? "generic"}
                            versionId={search.version}
                        />
                    )}
                    {search.panel === "places" && <FactPlacesPanel onOpenBlock={onOpenBlock} versionId={search.version} />}
                    {!search.panel && <V2DocumentReader focusBlockId={search.block} key={`${search.version}:${search.block ?? ""}`} versionId={search.version} />}
                </section>
            )}
            <V2FilingDocumentsView
                data={filing.data}
                error={filing.error}
                extraActions={doc => (
                    <>
                        <Button onClick={() => openVersion(doc.currentVersionId, "sections")} size="xs" type="button" variant="outline">Sections</Button>
                        <Button onClick={() => openVersion(doc.currentVersionId, "places")} size="xs" title="Where the XBRL facts sit in this document (PRO)" type="button" variant="outline">
                            Fact places
                        </Button>
                    </>
                )}
                isLoading={filing.isLoading}
                onRead={doc => doc.currentVersionId && openVersion(doc.currentVersionId)}
                selectedFilename={open?.filename ?? null}
            />
        </div>
    );
}

const OUTLINE_OPTIONS: Array<{ label: string; value: V2SectionOutline }> = [
    { label: "Headings", value: "generic" },
    { label: "Section ids (legacy)", value: "legacy" },
];

function SectionsPanel({ onOpenBlock, onOutline, outline, versionId }: {
    onOpenBlock: (block: string) => void;
    onOutline: (outline: V2SectionOutline) => void;
    outline: V2SectionOutline;
    versionId: string;
}) {
    const sections = useV2DocumentSectionsInfinite(versionId, outline === "generic" ? undefined : outline);

    return (
        <div className="flex flex-col gap-2">
            <FilterSelect aria-label="Outline" className="w-[200px]" onValueChange={onOutline} options={OUTLINE_OPTIONS} value={outline} />
            <DocumentSectionsView onOpenBlock={onOpenBlock} state={listState(sections)} />
        </div>
    );
}

function FactPlacesPanel({ onOpenBlock, versionId }: { onOpenBlock: (block: string) => void; versionId: string }) {
    const places = useV2FactPlacesInfinite(versionId);

    return <FactPlacesView onOpenBlock={onOpenBlock} state={listState(places)} versionId={versionId} />;
}

function ConceptFilter({ label, onTag, tag }: { label: string; onTag: (tag: string) => void; tag: string | undefined }) {
    return (
        <DebouncedInput
            aria-label={label}
            className="w-full max-w-[420px]"
            onCommit={onTag}
            placeholder="Concepts, comma list — e.g. Revenues,NetIncomeLoss"
            value={tag ?? ""}
        />
    );
}

function FactsTab({ accession, onTag, tag }: { accession: string; onTag: (tag: string) => void; tag: string | undefined }) {
    const facts = useV2FilingFactsInfinite(accession, tag);

    return (
        <div className="flex flex-col gap-2">
            <ConceptFilter label="Filter facts by concept" onTag={onTag} tag={tag} />
            <FilingFactsView accession={accession} state={listState(facts)} />
        </div>
    );
}

function NotesTab({ accession, onTag, tag }: { accession: string; onTag: (tag: string) => void; tag: string | undefined }) {
    const notes = useV2FilingNotesInfinite(accession, tag);

    return (
        <div className="flex flex-col gap-2">
            <ConceptFilter label="Filter notes by concept" onTag={onTag} tag={tag} />
            <FilingNotesView accession={accession} state={listState(notes)} />
        </div>
    );
}

const DEPTH_OPTIONS = [1, 2, 3, 4, 5, 6].map(value => ({ label: value === 1 ? "Direct relations" : `${value} hops`, value: String(value) }));

const DIRECTION_OPTIONS: Array<{ label: string; value: V2ReviewDirection }> = [
    { label: "Both directions", value: "both" },
    { label: "Relations it makes", value: "down" },
    { label: "Relations pointing at it", value: "up" },
];

function ReviewTab({ accession, depth, direction, onChange }: { accession: string; depth: number; direction: V2ReviewDirection; onChange: (patch: FilingSearch) => void }) {
    const chain = useV2ReviewChain(accession, { direction: direction === "both" ? undefined : direction, maxDepth: depth === 1 ? undefined : depth });

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <FilterSelect aria-label="Hops" className="w-[170px]" onValueChange={value => onChange({ depth: value === "1" ? undefined : Number(value) })} options={DEPTH_OPTIONS} value={String(depth)} />
                <FilterSelect aria-label="Direction" className="w-[220px]" onValueChange={value => onChange({ direction: value === "both" ? undefined : value })} options={DIRECTION_OPTIONS} value={direction} />
            </div>
            <ReviewChainView data={chain.data} error={chain.error} isLoading={chain.isLoading} />
        </div>
    );
}

function HoldingsTab({ accession }: { accession: string }) {
    const holdings = useV2FilingHoldingsInfinite(accession);

    return <FilingHoldingsView accession={accession} state={listState(holdings)} />;
}

function PartiesTab({ accession }: { accession: string }) {
    const filing = useV2Filing(accession, ["parties", "relations"]);

    return <FilingPartiesView data={filing.data} error={filing.error} isLoading={filing.isLoading} />;
}
