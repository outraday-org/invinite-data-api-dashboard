/**
 * What each SEC bulk data set is (the API names it by its SEC code): the `/sec/datasets` releases, bulk files and
 * company exports (backend tasks/sec-bulk-downloads task 8 moved it out of the route so the views import it alone).
 */
export const DATASET_LABELS: Partial<Record<string, string>> = {
    f13: "Form 13F (institutional holdings)",
    f345: "Forms 3, 4 and 5 (insider transactions)",
    formd: "Form D (private offerings)",
    fsn: "Financial statement and notes",
    icsc: "Investment company series and classes",
    ncen: "Form N-CEN (fund census)",
    nport: "Form N-PORT (fund holdings)",
    rr: "Mutual fund prospectus risk / return summaries",
};
