import { Notice } from "@/components/ui/notice";

export function SearchTimeoutNotice({ narrowBy, scoped }: { scoped: boolean; narrowBy: string }) {
    return (
        <Notice badge="Timed out" title="The search took too long" tone="warn">
            {scoped ? "The API stopped the search at its time limit, after a second attempt." : "A common word across every company can take too long even after a second attempt."}
            {" Try again in a moment, or narrow the search with "}
            {narrowBy}
            .
        </Notice>
    );
}
export function SearchNarrowHint({ limit, narrowBy}: { limit: number; narrowBy: string }) {
    return <p className="text-muted-foreground" data-testid="search-narrow">{`These are the top ${limit} passages. The API answers one page and pages no further. To find more, narrow the search with ${narrowBy}.`}</p>;
}
