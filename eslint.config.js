//  @ts-check

import stylistic from "@stylistic/eslint-plugin";
import { tanstackConfig } from "@tanstack/eslint-config";
import eslintPluginJsxA11y from "eslint-plugin-jsx-a11y";
import perfectionist from "eslint-plugin-perfectionist";
import pluginReact from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import * as pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReactRefresh from "eslint-plugin-react-refresh";

export default [
    {
        ignores: [
            // Agent tooling (plain JS outside tsconfig), not app code.
            "**/.claude/**",
            "**/.output/**",
            "**/.nitro/**",
            "**/dist/**",
            "**/node_modules/**",
        ],
    },
    ...tanstackConfig,
    stylistic.configs.customize({
        // the following options are the default values
        indent: 4,
        jsx: true,
        quotes: "double",
        semi: true,
        // ...
    }),
    {
        files: ["**/*.{js,jsx,ts,tsx}"],
        plugins: {
            "jsx-a11y": eslintPluginJsxA11y,
            perfectionist,
            "react": pluginReact,
            "react-compiler": reactCompiler,
            "react-hooks": pluginReactHooks,
            "react-refresh": pluginReactRefresh,
        },
        rules: {
            ...eslintPluginJsxA11y.configs.strict.rules,
            ...perfectionist.configs["recommended-natural"].rules,
            ...pluginReact.configs.recommended.rules,
            ...pluginReactHooks.configs.recommended.rules,
            // avoid circular autofix conflicts with other import sorters
            "import/order": "off",
            "padding-line-between-statements": [
                "error",
                { blankLine: "always", next: "export", prev: "*" },
                { blankLine: "any", next: "export", prev: "export" },
                { blankLine: "always", next: "class", prev: "*" },
                { blankLine: "always", next: "continue", prev: "*" },
                { blankLine: "always", next: "break", prev: "*" },
                { blankLine: "always", next: "return", prev: "*" },
                { blankLine: "always", next: "for", prev: "*" },
                { blankLine: "always", next: "expression", prev: "*" },
                { blankLine: "always", next: "function", prev: "*" },
                { blankLine: "always", next: "iife", prev: "*" },
                { blankLine: "always", next: "if", prev: "*" },
                { blankLine: "always", next: "const", prev: "*" },
                { blankLine: "always", next: "let", prev: "*" },
                { blankLine: "always", next: "var", prev: "*" },
                { blankLine: "always", next: "while", prev: "*" },
                { blankLine: "always", next: "with", prev: "*" },
                { blankLine: "always", next: "try", prev: "*" },
            ],
            "perfectionist/sort-modules": "off",
            "perfectionist/sort-object-types": "off",
            "react-compiler/react-compiler": "error",
            "react-hooks/exhaustive-deps": "warn",
            "react-hooks/incompatible-library": "off",
            "react-refresh/only-export-components": "off",
            "react/jsx-uses-react": "off",
            "react/prop-types": "off",
            "react/react-in-jsx-scope": "off",
            "sort-imports": "off",
        },
        settings: {
            react: {
                version: "detect",
            },
        },
    },
];
