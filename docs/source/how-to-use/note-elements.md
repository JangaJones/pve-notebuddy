# Note Elements (Rows)

NoteBuddy builds output from rows. Each row has content plus formatting metadata.

## Built-In Rows

- `Title`
- `Host / FQDN entries`
- `Network entries`
- `Config locations`
- `Custom rows`

## Host Entries

Host entries are label + URL pairs (with an icon). They are rendered as clickable links after sanitization.

## Network Entries

Network entries are free-form values (with icon), usually used for ports, addresses, and related notes.

## Config Locations

Config entries are commonly file paths or directories, each with optional icon.

## Custom Rows

Custom rows are flexible text blocks for additional details. They are useful for edge cases where predefined fields are not enough.

## Row Ordering

Rows can be reordered by dragging fieldset headers. Order is saved in local state and preserved across reloads.

## Visibility

Rows can be hidden without deleting content. Hidden rows remain in state and can be re-enabled later.
