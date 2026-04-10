# Updating Templates

Template generation lives under `templates/scripts/`.

## Main Scripts

- `auto-template.mjs`: interactive runner for template scripts
- `community-scripts.mjs`: crawls community-scripts source data
- `generate-templates.mjs`: generates normalized template JSON and `templates/index.json`

## Typical Workflow

From repository root:

```bash
cd templates/scripts
node auto-template.mjs
```

Or run scripts directly:

```bash
node community-scripts.mjs
node generate-templates.mjs
```

## Output Locations

- generated templates: `templates/community-scripts/`
- template index: `templates/index.json`
- reports/temp data: `templates/scripts/*-temp` and logs

## Recommendation

After generation:

1. inspect diffs
2. validate representative templates in UI
3. commit updated templates/index together
