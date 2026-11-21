// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api/errors";
import { announcementRow, newsroomItem } from "@/lib/news/news-fixtures";
import { AnnouncementFilters, AnnouncementsView, effectiveLabel } from "@/routes/$ticker/news/-components/announcements";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, className, search }: { children: React.ReactNode; className?: string; search: (prev: Record<string, unknown>) => Record<string, unknown> }) => (
        <a className={className} href={`?item=${String(search({}).item)}`}>{children}</a>
    ),
}));

vi.mock("@/lib/api/queries", () => ({ useV2AnnouncementsInfinite: vi.fn() }));

afterEach(cleanup);

const page = (rows = [announcementRow()]) => ({ data: rows, has_more: false, meta: {}, next_cursor: null });

const props = { error: null, filtered: false, hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined, scope: "NVDA" };

describe("effectiveLabel", () => {
    it("names the range with its precision, an open end, a single day, or the stated text", () => {
        expect(effectiveLabel(announcementRow())).toBe("Jul 1, 2027 – Dec 31, 2027 · quarter");

        expect(effectiveLabel(announcementRow({ date_precision: "day", effective_from: "2027-03-02", effective_to: "2027-03-02" }))).toBe("Mar 2, 2027");

        expect(effectiveLabel(announcementRow({ date_precision: "month", effective_to: null }))).toBe("from Jul 1, 2027 · month");

        expect(effectiveLabel(announcementRow({ effective_from: null, effective_to: null }))).toBe("second half of 2027");

        expect(effectiveLabel(announcementRow({ effective_date_text: null, effective_from: null, effective_to: null }))).toBe("—");
    });
});

describe("AnnouncementsView", () => {
    it("lists announced time, title + summary + names, topic, claim status, effective range and the news item link", () => {
        render(<AnnouncementsView {...props} pages={[page()]} />);

        const row = screen.getByText("Rubin availability").closest("tr") as HTMLElement;

        expect(within(row).getByText("NVIDIA plans to ship Rubin in H2 2027.")).toBeTruthy();

        expect(within(row).getByText("Names: Rubin, Foxconn")).toBeTruthy();

        expect(within(row).getByText("Availability")).toBeTruthy();

        expect(within(row).getByText("Planned")).toBeTruthy();

        expect(within(row).getByText("Jul 1, 2027 – Dec 31, 2027 · quarter")).toBeTruthy();

        expect(within(row).getByText("“second half of 2027”")).toBeTruthy();

        expect(within(row).getByRole("link", { name: newsroomItem().title })).toHaveAttribute("href", `?item=${newsroomItem().id}`);

        // Tabular: the export menu sits above the table.
        expect(screen.getByText("Export")).toBeTruthy();
    });

    it("names the filters in the empty line and renders the plan gate as a STANDARD notice", () => {
        render(<AnnouncementsView {...props} filtered pages={[page([])]} />);

        expect(screen.getByText("No announcements match these filters.")).toBeTruthy();

        cleanup();

        render(<AnnouncementsView {...props} error={new ApiRequestError(403, { error: "Forbidden", message: "Upgrade" })} pages={[]} />);

        expect(screen.getByText("Your plan does not include announcements")).toBeTruthy();
    });
});

describe("AnnouncementFilters", () => {
    it("writes the announced / effective days and resets every filter", () => {
        const onChange = vi.fn();

        render(<AnnouncementFilters onChange={onChange} search={{ aTopic: "partnership" }} />);

        fireEvent.change(screen.getByLabelText("Effective from"), { target: { value: "2027-01-01" } });

        expect(onChange).toHaveBeenLastCalledWith({ effFrom: "2027-01-01" });

        fireEvent.change(screen.getByLabelText("Announced from"), { target: { value: "2026-10-01" } });

        expect(onChange).toHaveBeenLastCalledWith({ aFrom: "2026-10-01" });

        fireEvent.click(screen.getByText("Reset"));

        expect(onChange).toHaveBeenLastCalledWith({ aFrom: undefined, aSort: undefined, aTo: undefined, aTopic: undefined, effFrom: undefined, effTo: undefined });
    });
});
