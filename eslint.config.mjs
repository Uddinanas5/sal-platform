import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores([
    ".next/**",
    "prisma/generated/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
  {
    extends: [...nextCoreWebVitals, ...nextTypescript],
    rules: {
      // eslint-config-next 16 turned on the React-Compiler-era hooks rules as
      // errors; they flag ~38 pre-existing setState-in-effect / render-purity
      // patterns. Kept visible as warnings — burning them down is L-053 (a
      // behavior-sensitive refactor, deliberately not folded into the CVE bump).
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);
