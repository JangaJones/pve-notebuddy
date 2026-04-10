# Icons

Icon handling is one of the main strengths of NoteBuddy.

## Icon Modes

- `Single`: one remote icon URL
- `Gallery`: multiple icon URLs in a grid
- `Image File`: upload local SVG or raster image

## Allowed Remote Icon Types

Remote icon URLs are validated by extension:

- `.svg`
- `.gif`
- `.jpeg` / `.jpg`
- `.png`
- `.tif`
- `.webp`

## SVG Handling

For SVG-based icons you can choose:

- embed SVG directly for quality and offline rendering
- resize via `wsrv.nl` (or your own `weserv/images` domain)

You can also switch icon color variant in supported cases.

## Upload Limits

Current limits in app config:

- SVG upload text: up to 1 MiB
- Raster upload (png/jpg/gif/webp): about 6 KiB

If a file exceeds limits, upload/import is blocked.

## Gallery Notes

Gallery mode supports multiple URLs (validated), configurable columns, and spacing presets.

## Best Practices

- prefer SVG for crisp scaling
- use local upload for full control
- use resize mode only when you need remote image transformation/caching
