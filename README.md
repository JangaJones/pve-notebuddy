# 🗒️ PVE NoteBuddy

Live: https://jangajones.github.io/pve-notebuddy/

PVE NoteBuddy is a lightweight web app for generating clean HTML snippets for Proxmox VE Notes.

It helps you build note blocks (icon, host data, config paths, custom notes) with quick formatting controls and live preview.

It also solves the common PVE Notes image sizing issue by pasting a link to an SVG icon and extracting the svg code with the option to scale the image.
No external CDN, all offline, no separate editing, vector quality :)

It’s fully client-side in the browser.
No backend is used, and no data is sent by the app itself.
Only if you provide an external icon URL, the browser does fetch that image/SVG directly from that external host.

One of the many notes I made with this tool in a few seconds:

![Demo Picture](/demo.png)