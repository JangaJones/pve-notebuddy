# Formatting Controls

Each row has independent formatting controls.

## Alignment

Available alignment per row:

- left
- center
- right

## Heading Levels

Rows can be promoted to heading tags:

- `H1`
- `H2`
- `H3`
- `H4`
- `H5`

## Text Style Toggles

- italic
- bold
- strong
- code

## Important Behavior

- Heading selection is mutually exclusive.
- Bold and strong are treated as conflicting styles in the UI logic.
- Formatting is applied to final generated HTML, not only preview text.

## Practical Recommendation

For readable Proxmox notes:

- use `H2` or `H3` for section headers
- keep path-like values as `code`
- avoid stacking too many styles on one row
