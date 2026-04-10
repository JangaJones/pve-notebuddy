# Preview Sidebar

The preview sidebar shows rendered note output and export controls.

## What It Contains

- rendered preview card
- generated HTML output text area
- output length indicator
- copy HTML button

## Width and Resizing

Preview width is resizable and persisted.

Configured bounds:

- minimum: 358 px
- default: 468 px
- maximum: 600 px

## Length Validation

The app checks output length against the 8192-character limit.

- within limit: copy enabled
- over limit: warning shown, copy disabled

## Light / Dark Display

Preview rendering supports light/dark display mode to match your working preference.

## Copy Behavior

Copy button copies generated HTML output exactly as shown in output text area.
