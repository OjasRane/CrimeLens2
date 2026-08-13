import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // This existing UI intentionally uses effect-driven view resets and
      // mutable interaction refs. Keep useful correctness linting enabled
      // without treating React Compiler optimization hints as build failures.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      // CrimeLens renders `//` as part of its terminal visual language.
      "react/jsx-no-comment-textnodes": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "**/.venv/**",
    "next-env.d.ts",
    "public/maplibre-gl-shared.mjs",
    "public/maplibre-gl-worker.js",
  ]),
]);
