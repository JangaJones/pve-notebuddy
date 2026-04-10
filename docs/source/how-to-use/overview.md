# Overview

This page covers the UI layout and the normal workflow from empty form to copied HTML.

## Main UI Areas

- Top bar: template search, project links, support links
- Left sidebar tabs: Templates, Emoji, Settings
- Main editor: icon row plus content rows
- Preview sidebar: rendered output, character count, copy action

## Typical Workflow

1. Pick a template (optional).
2. Configure icon mode and icon source.
3. Fill row content (title, host links, network, config, custom rows).
4. Apply formatting and alignment.
5. Check preview and output length.
6. Copy HTML and paste into Proxmox notes.

## Reload and Hard Reload Behavior

Most state is stored in local storage (`pve-notebuddy:state-v1`).

- Normal reload: keeps your saved app state.
- Hard reload: still keeps local storage state, but refreshes static assets.
- Clearing site data/local storage: resets state.

## Row Visibility and Order

Rows can be reordered by drag-and-drop and toggled visible/hidden. Order and visibility are persisted in app state.

## Output Limit

The output target is validated against a maximum length of 8192 characters. If exceeded, copy is disabled until content is shortened.
