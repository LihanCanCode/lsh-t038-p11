# Third-Party Material and AI Disclosure

List material frameworks, libraries, starters, templates, UI kits, fonts, icons and assets used in this repository.

| Name | Version or source URL | Licence | Used for |
|---|---|---|---|
| create-next-app | 16.3.3 (`npx create-next-app@latest`) | MIT | Initial project scaffold (Next.js App Router, TypeScript, Tailwind, ESLint config) |
| Next.js | 16.3.3 | MIT | App framework (routing, dev/build tooling) |
| React | 19.2.8 | MIT | UI library |
| React DOM | 19.2.8 | MIT | React renderer |
| Zod | ^4.5.4 | MIT | Runtime schema validation of uploaded dataset JSON |
| Zustand | ^5.0.15 | MIT | Client-side state store (uploaded dataset, selected case) |
| Tailwind CSS | ^4 | MIT | Utility CSS framework |
| @tailwindcss/postcss | ^4 | MIT | Tailwind PostCSS integration |
| TypeScript | ^5 | Apache-2.0 | Static typing |
| ESLint / eslint-config-next | ^9 / 16.3.3 | MIT | Linting |
| Vitest | ^4.1.11 | MIT | Unit/integration test runner |
| @types/node, @types/react, @types/react-dom | ^20 / ^19 | MIT | TypeScript type declarations (dev-only) |
| Geist, Geist Mono | https://vercel.com/font (via `next/font/google`) | SIL Open Font License 1.1 | App typography |

## AI tools

List each AI tool in `evaluation-manifest.json`, what it was used for and how the output was verified. Write `None` if no AI tool was used.

- **Claude Code (Anthropic, Claude Sonnet 5)** — used throughout the event as an AI pair-programmer: scaffolding, the scheduling engine (`lib/engine/*`: time/travel helpers, feasibility checking, greedy assignment, manual-move validation, mid-day re-planning, sick-technician re-planning, scoring), the Next.js UI (upload/case selection, technician timelines, drag-and-drop reassignment, emergency-job and sick-technician forms, plan comparison), and this file. Verified by: a 161-test Vitest suite (including invariant checks run against all 25 bundled cases, not just hand-built fixtures), `tsc --noEmit` type-checking, `eslint` with zero warnings, manual review of every diff before acceptance, and manual exercising of the running app in-browser.

## Original-work statement

Everything not declared in this file or `EVENT.md` was created by the registered team during the event window.
