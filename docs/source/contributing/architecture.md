# Repository Architecture

## Top-Level Structure

- `index.html`: static app shell and UI markup
- `resources/`: app CSS, JS modules, fonts, and shared icons
- `templates/`: curated template data plus generation scripts
- `updater/`: update-related assets and helper scripts for self-hosted packaging
- `docs/`: isolated documentation workspace (own `package.json` + lockfile)
- `.github/workflows/`: CI, CodeQL, release packaging, and Pages deployment

Generated/local-only paths in this repo:

- `node_modules/`: installed dependencies (root workspace)
- `docs/node_modules/`: installed dependencies (docs workspace)
- `.preview/`: local preview/output artifacts of the documentation

## JavaScript Module Areas

Under `resources/js/`:

- `core/`: config, DOM refs, state normalization, utility helpers
- `services/`: storage and data access abstractions
- `features/`: UI feature modules (templates, settings, icon handling, preview, row editor, emoji)
- `main.js`: orchestration and wiring

## State and Persistence

- runtime state is normalized and persisted in browser local storage
- imports for templates/settings are validated before acceptance
- migration logic keeps compatibility with legacy storage keys

## Templates Search Subsystem

- template payloads live in `templates/*`
- indexing is driven by `templates/template-search-index.json`
- generation/maintenance scripts live in `updater/scripts/`

## Security-Oriented Handling

- strict CSP is defined in `index.html`
- custom HTML input as well as SVG embedding is sanitized with vendored `DOMPurify` (`resources/js/vendor/purify.es.mjs`)
- remote icon sources are constrained by extension/validation rules
- imported data has size and schema validation guards

## Docs System

- docs content source is `docs/source`
- VitePress config is `docs/.vitepress/config.mjs`
- static docs-only assets are served from `docs/public/` (for example `docs/public/icons/notebuddy-logo.svg`) and are located inside `docs/source/public`
- docs base path is environment-driven via `DOCS_BASE`
  - local docs profile: `/docs/`
  - GitHub Pages profile: `/pve-notebuddy/docs/`
- docs toolchain is currently `vitepress@2.0.0-alpha.17`

## CI and Delivery Workflows

- `CI` workflow:
  - installs root dependencies and verifies vendored DOMPurify is in sync
  - syntax-checks JS modules and validates JSON fixtures/templates
  - installs docs dependencies and builds docs
- `CodeQL Advanced` workflow runs JavaScript code scanning on pushes/PRs/schedule
- `Build Release Package` workflow assembles a self-hosted zip artifact for releases
- `Deploy GitHub Pages` workflow builds docs with `DOCS_BASE=/pve-notebuddy/docs/`, assembles `_site`, uploads artifact, and deploys with Pages actions
