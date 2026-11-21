import { RequestErrorState } from "@/components/ui/request-error-state";

/**
 * The state of a failed people request (`/v1/people*`, `/v1/participants?person=`): the plan gate, a 404 (`notFound`
 * when given, else the API's own words — a fund named as a company answers 404 `not_covered`), a 400 with the API's
 * message, anything else as `ErrorState` (`RequestErrorState` with the people options).
 */
export function PeopleState({ error, notFound, title }: { error: unknown; notFound?: string; title: string }) {
    return (
        <RequestErrorState
            badRequest={{ badge: "Invalid request" }}
            error={error}
            notFound={{ badge: "Not found", title: notFound }}
            tier={{ badge: "STANDARD", title: "Your plan does not include people" }}
            title={title}
        />
    );
}
