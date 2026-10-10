import { describe, expect, it } from "vitest";

import {
    LIVE_STREAM_REFRESH_BEFORE_MS,
    MEDIA_URL_REFRESH_BEFORE_MS,
    msUntilRefresh,
    urlNeedsRefresh,
} from "./media-timing";

const EXPIRES_AT = "2026-10-10T12:15:00.000Z";

const EXPIRES_MS = Date.parse(EXPIRES_AT);

describe("urlNeedsRefresh", () => {
    it("does not refresh at exactly expiresAt − before, refreshes one ms later", () => {
        const boundary = EXPIRES_MS - MEDIA_URL_REFRESH_BEFORE_MS;

        expect(urlNeedsRefresh(EXPIRES_AT, boundary, MEDIA_URL_REFRESH_BEFORE_MS)).toBe(false);

        expect(urlNeedsRefresh(EXPIRES_AT, boundary + 1, MEDIA_URL_REFRESH_BEFORE_MS)).toBe(true);
    });

    it("refreshes a URL that already expired", () => {
        expect(urlNeedsRefresh(EXPIRES_AT, EXPIRES_MS + 60_000, MEDIA_URL_REFRESH_BEFORE_MS)).toBe(true);
    });

    it("never refreshes a null or unreadable expiry", () => {
        expect(urlNeedsRefresh(null, EXPIRES_MS, MEDIA_URL_REFRESH_BEFORE_MS)).toBe(false);

        expect(urlNeedsRefresh("not a date", EXPIRES_MS, MEDIA_URL_REFRESH_BEFORE_MS)).toBe(false);
    });

    it("uses the live-stream lead time when asked", () => {
        const now = EXPIRES_MS - 4 * 60_000;

        expect(urlNeedsRefresh(EXPIRES_AT, now, MEDIA_URL_REFRESH_BEFORE_MS)).toBe(false);

        expect(urlNeedsRefresh(EXPIRES_AT, now, LIVE_STREAM_REFRESH_BEFORE_MS)).toBe(true);
    });
});

describe("msUntilRefresh", () => {
    it("is zero at exactly expiresAt − before", () => {
        expect(msUntilRefresh(EXPIRES_AT, EXPIRES_MS - MEDIA_URL_REFRESH_BEFORE_MS, MEDIA_URL_REFRESH_BEFORE_MS)).toBe(0);
    });

    it("counts down to expiresAt − before", () => {
        const now = EXPIRES_MS - 15 * 60_000;

        expect(msUntilRefresh(EXPIRES_AT, now, MEDIA_URL_REFRESH_BEFORE_MS)).toBe(13 * 60_000);
    });

    it("is zero (refresh now) for a past expiry", () => {
        expect(msUntilRefresh(EXPIRES_AT, EXPIRES_MS + 1, MEDIA_URL_REFRESH_BEFORE_MS)).toBe(0);
    });

    it("is undefined for a null or unreadable expiry", () => {
        expect(msUntilRefresh(null, EXPIRES_MS, MEDIA_URL_REFRESH_BEFORE_MS)).toBeUndefined();

        expect(msUntilRefresh("not a date", EXPIRES_MS, MEDIA_URL_REFRESH_BEFORE_MS)).toBeUndefined();
    });
});
