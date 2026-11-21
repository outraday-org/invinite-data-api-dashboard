import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { ApiRequestError, isTierError } from "@/lib/api/errors";

/**
 * The state of a failed people request (`/v1/people*`, `/v1/participants?person=`): the plan gate, a 404 (`notFound`
 * when given, else the API's own words — a fund named as a company answers 404 `not_covered`), a 400 with the API's
 * message, anything else as `ErrorState`.
 */
export function PeopleState({ error, notFound, title }: { error: unknown; notFound?: string; title: string }) {
    if (isTierError(error)) return <Notice badge="STANDARD" title="Your plan does not include people" />;

    if (error instanceof ApiRequestError) {
        if (error.status === 404) return <Notice badge="Not found" title={notFound ?? error.message} />;

        if (error.status === 400) return <Notice badge="Invalid request" title={error.message} />;
    }

    return <ErrorState error={error} title={title} />;
}
