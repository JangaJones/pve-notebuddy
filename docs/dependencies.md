## Sanitization Dependency (DOMPurify)

DOMPurify is tracked in `package.json` and also vendored as `resources/js/vendor/purify.min.js` so static/offline deployments work without running `npm install`.

To refresh the vendored file from the pinned npm dependency:

```bash
npm install
npm run vendor:dompurify
```
