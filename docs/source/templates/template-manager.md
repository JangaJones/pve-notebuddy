# Template Manager

Template Manager controls local templates and template JSON import/export.

## Local Templates

You can save the current editor state as a local template with a custom name.

Stored data includes:

- row order and visibility
- icon settings
- field values
- formatting options

Local templates are persisted in app state (`templates.localCatalog`) inside browser local storage.

## Operations

- Save current state to local template
- Load local template
- Delete local template
- Import template JSON file
- Export selected template JSON file

## Name Collisions During Import

If a template with same name exists, imported names are auto-suffixed, for example `My Template (2)`.

## Validation

Imported templates are schema-validated. Invalid or oversized files are rejected.
