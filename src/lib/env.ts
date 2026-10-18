import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
    emptyStringAsUndefined: true,
    runtimeEnv: process.env,
    server: {
        INVINITE_DATA_API_KEY: z.string().min(1, "Set INVINITE_DATA_API_KEY in the environment").optional(),
        INVINITE_DATA_API_URL: z.url().default("https://api.data.invinite.com"),
    },
});
