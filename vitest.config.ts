import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Kept apart from vite.config.ts so the Netlify / TanStack Start plugins never load under vitest.
// `*.test.ts` run in node; a component test (`*.test.tsx`) opts into jsdom with the pragma
// `// @vitest-environment jsdom` on its first line (vitest 4 has no environmentMatchGlobs).
export default defineConfig({
    plugins: [
        viteTsConfigPaths({
            projects: ["./tsconfig.json"],
        }),
        viteReact(),
    ],
    test: {
        environment: "node",
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        setupFiles: ["src/test/setup.ts"],
    },
});
