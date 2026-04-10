# Repository Architecture

## Top-Level Structure

- `index.html`: app shell and UI markup
- `resources/`: CSS, JS modules, icons, fonts
- `templates/`: template datasets and generation scripts
- `docs/`: VitePress documentation source and config
- `.github/workflows/`: CI, CodeQL, Pages deployment

## JavaScript Module Areas

Under `resources/js/`:

- `core/`: config, DOM refs, state normalization, utility helpers
- `services/`: storage and data access abstraction
- `features/`: UI features (templates, settings, icon handling, preview, row editor, emoji)
- `main.js`: orchestration and wiring

## State and Persistence

- app state is normalized and stored in local storage
- schema validation exists for template/settings import
- legacy storage keys are migrated where needed

## Templates Subsystem

- static template files in `templates/*`
- indexed by `templates/index.json`
- generation pipeline in `templates/scripts/`

## Security-Oriented Handling

- strict CSP in `index.html`
- sanitization for custom HTML content
- remote icon URL extension restrictions
- import size and schema checks

## Docs System

- source markdown in `docs/source`
- VitePress config in `docs/.vitepress/config.mjs`
- base path selected by environment (`DOCS_BASE`)
