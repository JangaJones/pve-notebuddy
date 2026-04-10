# Template Search

Template Search helps you quickly load one of the public template JSON files.

## Where Templates Come From

The app loads `./templates/index.json`, then resolves file paths under `./templates/`.

Catalog entries include:

- `community-scripts/*` (tag: PVE Scripts)
- `selfhst/*` (tag: selfh.st)
- `custom/*` (tag: Custom)

## Search Behavior

Search matches against:

- template name
- file path
- tag

When input is empty and focused, random suggestions are shown.

## Source Attribution

The project uses data from community-scripts and selfh.st icon ecosystems as part of template generation workflows.
