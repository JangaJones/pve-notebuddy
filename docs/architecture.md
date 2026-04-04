# JavaScript Architecture

## Overview
The app uses a feature-first ES module structure under `resources/js/`.

- `main.js`: module entrypoint and orchestration/runtime composition.
- `core/`: shared configuration and foundational helpers.
- `services/`: external I/O abstractions (browser storage, network service adapters).
- `features/`: domain features (sidebar, settings, emoji, templates, preview, etc.).

## Dependency Direction
Use this direction only:

1. `main.js` -> `core/*`, `services/*`, `features/*`
2. `features/*` -> `core/*`, `services/*`
3. `core/*` and `services/*` do not import from `features/*`

Avoid circular imports.

## Ownership Rules
- **core/**
  - Stateless shared logic and application constants.
  - App-state normalization and migration-safe state store helpers.
- **services/**
  - Side-effect wrappers (e.g. `localStorage` access).
  - No UI behavior.
- **features/**
  - Feature behavior and UI event orchestration.
  - Feature module APIs should be `createXFeature(...)` or `initXFeature(...)`.

## Current Module Status
Extracted and wired:
- `core/config.js`
- `core/state.js`
- `core/dom.js`
- `core/utils.js`
- `services/storage.service.js`
- `services/http-cache.service.js`
- `services/github-metadata.js`
- `services/template-catalog.service.js`
- `features/sidebar.js`
- `features/settings.js`
- `features/emoji.js`
- `features/template-search.js`
- `features/template-manager.js`
- `features/template-settings.js`
- `features/template-settings-schema.js`
- `features/app-icons.js`
- `features/note-builder.js`
- `features/preview.js`
- `features/row-editor.js`
- `features/app-shell.js`

Remaining in `main.js`:
- Bootstrap composition and dependency wiring (`createXFeature(...)` setup).
  Current orchestration phases:
  `createFeatures`, `initFeatureUi`, `createMetadataServices`, `wireFeatureInteractions`, `applyInitialRuntime`, `loadInitialMetadata`.
- Shared runtime state bridges (`iconResolvedSrc`, upload buffers, block flags).
- Thin adapter helpers that route between features (`prepareIcon`, radio/value bridges, `applyStateToRuntime`).

Moved out of `main.js` in recent cleanup:
- DOM element querying centralized in `core/dom.js` via `getAppDomRefs()`.
- Row editor interactions moved to `features/row-editor.js` (`initRowEditorInteractions`).
- Icon interactions moved to `features/app-icons.js` (`initIconInteractions`).
- Preset button wiring moved to `features/template-settings.js` (`initPresetInteractions`).
- Default row bootstrap moved to `features/row-editor.js` (`initDefaultRows`).
- Output length/copy-disable preview logic moved to `features/preview.js`.
