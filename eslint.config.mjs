import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Vendored / generated assets in public/ (pdf.js worker, service workers) — never lint these.
      "public/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // `any` is used deliberately throughout for postgres.js result rows and
      // dynamic JSONB payloads (see CLAUDE.md). Surface it as a warning to nudge
      // incremental typing rather than block the build.
      "@typescript-eslint/no-explicit-any": "warn",
      // Ignore unused caught errors (idiomatic `catch (e) {}`) and any binding
      // intentionally prefixed with `_`. Genuinely unused imports/vars still error.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
    },
  },
]

export default eslintConfig
