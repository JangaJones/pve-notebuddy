# PVE NoteBuddy

Live: https://jangajones.github.io/pve-notebuddy/

PVE NoteBuddy is a lightweight client-side web app for generating clean HTML snippets for Proxmox VE Notes.

It helps you build custom blocks (icon, host data, config paths, custom notes) ready to paste into Proxmox.

It also solves the common PVE Notes image sizing issue by pasting a link to an SVG icon and extracting the svg code with the option to scale the image.
No external CDN, all offline, no separate editing, vector quality :)

## 🚀 Features
- No CDN needed for your custom app icons anymore! Paste a link to an SVG or upload an SVG, the script takes care of the rest.
- Import & Export your customized note as JSON to come back later for more notes in the same styling
- Fully customizable with everything the styling in Proxmox Notes have to offer -> You can clear all filled blocks and just use the Icon + Additional Notes Block
- Reorder all the Blocks how you like, e.g. move the Icon below the Name Heading in the Notes section
- Additional Notes block is not sanitizing HTML, you can use `<p />`, `</br>`, `<pre />` and everything else that is listed in the Proxmox Documentation.

_It’s fully client-side in the browser.
No backend is used, and no data is sent or saved by the app itself.
Only if you provide an external icon URL, the browser does fetch that image/SVG directly from that external host._

One of the many notes I made with this tool in a few seconds:

![Demo Picture](/demo.png)
