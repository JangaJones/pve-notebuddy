# Documentation Workspace

- Markdown source files: `docs/source`
- VitePress config: `docs/.vitepress/config.mjs`
- Generated local build output (ignored): `docs/.vitepress/dist`

## Local Build

```bash
cd docs
npm install
npm run build:local
```

## Local Preview

```bash
cd docs
npm run preview
```

## GitHub Pages Build

Docs for GitHub Pages are built in CI with:

```bash
cd docs
npm run build:pages
```

The deploy workflow publishes the app at `/` and the docs at `/docs/`.
