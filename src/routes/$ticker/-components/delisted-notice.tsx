import { Link } from "@tanstack/react-router";

import type { V2Instrument } from "@/lib/api/types";

import { Notice } from "@/components/ui/notice";
import { delistedText } from "@/lib/instruments";

/**
 * The state of a delisted symbol (Data API 12): it is delisted, not "not covered". The API answers its listing (the
 * Overview) and, for a company, the SEC filer record by CIK (`/sec/$cik`: identity, lifecycle, Form D offerings); the
 * notice links both. A section other than the Overview shows it instead of the page (`TickerLayout`).
 */
export function DelistedNotice({ instrument, onOverview }: { instrument: Pick<V2Instrument, "company" | "symbol">; onOverview: boolean }) {
    const cik = instrument.company?.cik;

    const action = (
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {!onOverview && (
                <Link className="underline-offset-4 hover:underline" params={{ ticker: instrument.symbol }} to="/$ticker">
                    The listing
                </Link>
            )}
            {cik && (
                <Link className="underline-offset-4 hover:underline" params={{ cik }} title={`SEC filer · CIK ${cik}`} to="/sec/$cik">
                    SEC filer record
                </Link>
            )}
        </span>
    );

    return (
        <Notice action={!onOverview || cik ? action : undefined} badge="Delisted" title={`${instrument.symbol} is delisted`}>
            {delistedText(instrument)}
        </Notice>
    );
}
