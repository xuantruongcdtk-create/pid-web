import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // PID-specific tuning. The strict defaults from `eslint-config-next` flag a
  // handful of legitimate patterns; we downgrade them to warnings or off so
  // CI fails only on real bugs (parse errors, missing imports, unsafe React
  // patterns like creating components inside render).
  {
    rules: {
      // `catch (error: any)` is the idiomatic shape across the codebase —
      // narrowing every catch would balloon the diff. Treat as warning so the
      // hint still appears but doesn't break the lint gate.
      "@typescript-eslint/no-explicit-any": "warn",
      // React 19's strict rule flags setState inside an effect that's used
      // for legitimate one-shot work (localStorage restore, auto-select first
      // item, etc.). The rule has false positives; keep as warning.
      "react-hooks/set-state-in-effect": "warn",
      // Dependency-array completeness — keep as warning so devs see the hint
      // but it doesn't block builds for derived-data hooks.
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]);

export default eslintConfig;
