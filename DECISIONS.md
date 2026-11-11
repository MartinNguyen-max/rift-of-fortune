# Decisions Log

Decisions made while building the MVP autonomously, with the reasoning.

## Step 1 – Scaffold

- **ESLint instead of oxlint.** The current Vite template ships oxlint, but CLAUDE.md and the task ask for ESLint. Used ESLint 10 flat config with `typescript-eslint` (strict preset), `react-hooks` and `react-refresh`.
- **TypeScript 6.0 instead of 7.0.** The Vite template uses TS 7, but `typescript-eslint` only supports TS < 6.1 for now. Upgrade once it supports TS 7.
- **Strict TS plus `noUncheckedIndexedAccess`.** Safer access into champion/item maps and arrays.
- **Vitest `pool: 'vmThreads'`.** The default `forks`/`threads` pools crash on this Windows machine (`Cannot read properties of undefined (reading 'config')`) in both Vitest 4 and 5, likely because of the lowercase drive letter in the path. `vmThreads` works. Try removing it on another machine or in CI.
- **Tailwind v4 via `@tailwindcss/vite`.** No `tailwind.config.js` needed. Theme colours live in `src/index.css`.
- **`npm run data` runs `node scripts/fetch-data.ts` directly.** Node 22.18+ strips TypeScript types natively, so no `tsx`/`ts-node` dependency.
- **`@dnd-kit/core` only.** Sortable/utilities aren't needed for dropping cards into slots.
- **npm audit warning (minimatch, moderate)** comes from ESLint's dev-only tooling. It does not ship to the browser. The only "fix" downgrades ESLint, so it was left as is.
