const ACCESSION = /^(\d{10})-?(\d{2})-?(\d{6})$/;

/**
 * EDGAR folder of a filing: `https://www.sec.gov/Archives/edgar/data/<cik>/<accession-no-dashes>/`
 * (CIK without leading zeros). `null` when either part is missing or malformed.
 */
export function edgarFolderUrl(cik: null | string | undefined, accession: null | string | undefined): null | string {
    const cikDigits = cik?.trim() ?? "";

    if (!/^\d{1,10}$/.test(cikDigits) || Number(cikDigits) === 0) return null;

    const match = ACCESSION.exec(accession?.trim() ?? "");

    if (!match) return null;

    return `https://www.sec.gov/Archives/edgar/data/${Number(cikDigits)}/${match[1]}${match[2]}${match[3]}/`;
}
