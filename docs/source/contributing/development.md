# Development Setup

This page explains setting up the project in your IDE.

## App Development

Clone the dev repository to your working directory, install dependencies and vendor the latest dompurify:

```bash
git clone --branch dev https://github.com/JangaJones/pve-notebuddy.git
cd pve-notebuddy
npm ci
npm run vendor:dompurify
```

Serve repo root and open `http://localhost:8080/`.

```
npx serve -l 8080
```

## Docs Development

Refer to [architecture](../contributing/architecture) for documentation structure.

```bash
cd docs
npm install
npm run dev
```

For production-like docs build from project root and move the files to the correct folder structure:

```bash
npm run --prefix docs build:local
mkdir -p .preview/docs
rsync -a --delete docs/.vitepress/dist/ .preview/docs/
```

Serve static server from project root and open `localhost:8080/docs/`:

```
npx serve .preview -l 8080
```
