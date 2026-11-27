import { useQuery } from "@tanstack/react-query";

import { getStorageHtml, isStorageUrl } from "@/lib/storage-html";

/** The file read in the browser; null = the browser may not read it (no CORS header for this origin: localhost). */
async function readInBrowser(url: string) {
    let res: Response;

    try {
        // Do not send credentials for public/signed storage URLs to avoid CORS issues
        res = await fetch(url);
    }
    catch {
        return null;
    }

    if (!res.ok) {
        throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`);
    }

    return res.text();
}

export const useGetHtmlStorageContent = (url: null | string | undefined) => {
    const queryResult = useQuery<{ text: null | string }>({
        enabled: Boolean(url),
        gcTime: 5 * 60 * 1000,
        queryFn: async () => {
            if (!url) return { text: null };

            const text = await readInBrowser(url);

            if (text !== null) return { text };

            // Refused by CORS: a storage file is read by the server instead (so a value can still be marked).
            if (!isStorageUrl(url)) throw new Error("The file cannot be read from this origin");

            return getStorageHtml({ data: { url } });
        },
        queryKey: ["htmlStorageContent", { url }],
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000,
    });

    const { data, ...rest } = queryResult;

    return { text: data?.text ?? null, ...rest };
};
