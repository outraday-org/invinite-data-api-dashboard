import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Kept apart from vite.config.ts so the Netlify / TanStack Start plugins never load under vitest.
export default defineConfig({
    plugins: [
        viteTsConfigPaths({
            projects: ["./tsconfig.json"],
        }),
    ],
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
});
