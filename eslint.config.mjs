import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Netlify Functions use CommonJS and should not be linted by the
    // TypeScript ESLint rules configured for the Next.js app.
    "netlify/**",
    // Build output, not source. `netlify build` writes the compiled server
    // handler and edge functions here; it is gitignored but ESLint does not
    // read .gitignore, so without this every local run after a build reports
    // hundreds of errors in generated code and `npm run lint` can never be
    // clean. CI never saw it because a fresh checkout has no such directory.
    ".netlify/**",
    // Claude Code's tooling directory — settings, skills, and git worktrees
    // of this same repo, which would otherwise be linted a second time.
    ".claude/**",
  ]),
]);

export default eslintConfig;
