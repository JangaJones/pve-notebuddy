# Development Setup

This page explains local setup for app and docs plus CI pipeline overview.

## App Development

```bash
git clone --branch dev https://github.com/JangaJones/pve-notebuddy.git
cd pve-notebuddy
npm ci
npm run vendor:dompurify
```

Serve repo root with any static server and open `http://localhost:<port>/`.

## Docs Development

```bash
cd docs
npm install
npm run dev
```

For production-like docs build:

```bash
npm run build:local
```

## CI Pipeline Summary

Current workflows include:

- `CI`: dependency install, vendored file sync check, JS syntax checks, JSON validation, docs build
- `CodeQL`: security/static analysis for JavaScript
- `Pages`: app + docs deployment artifact assembly and publication

## Quality Guidance

- keep code modular by feature (`resources/js/features`)
- preserve schema compatibility for imported templates/settings
- test output behavior and length boundary after UI changes
