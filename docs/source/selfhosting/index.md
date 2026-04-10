# Self-Hosting Overview

PVE NoteBuddy must run behind a static web server. Opening `index.html` directly from `file://` is not supported due to browser fetch restrictions for template JSON and related assets.

## Requirements

- any static file host (Nginx, Caddy, Apache, Python http.server, etc.)
- app files served over `http://` or `https://`

## Docs Availability Note

In production usage, documentation is hosted on GitHub Pages under `/docs/`. If you deploy only the app files internally, docs are not bundled unless you also host the docs build output.

## Release Bundle Note

Release bundles generated from CI/workflows typically contain static app assets (root `index.html`, `resources/`, `templates/`, and supporting files). Always verify release notes for exact contents of a specific release artifact.
