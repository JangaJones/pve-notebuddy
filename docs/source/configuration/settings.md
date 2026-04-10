# Settings

This page explains persisted app state, keys, and settings panel behavior.

## Local Storage Model

Primary storage key:

- `pve-notebuddy:state-v1`

State includes:

- UI state (active sidebar panel, preview sidebar width, collapsed state)
- app settings (`weservDomain`, `svgPreferredMode`)
- local template catalog

Legacy keys are migrated/normalized by the state layer.

## Settings Panel Sections

- Custom `weserv/images` URL
- Preferred SVG mode (`embed` or `resize`)
- Settings backup export/import
- Reset to defaults

## Persistence Behavior

- values are written to local storage
- restored on next load
- reset clears to configured defaults

## Safety Notes

- imported settings files are validated and size-limited
- invalid settings files are ignored
