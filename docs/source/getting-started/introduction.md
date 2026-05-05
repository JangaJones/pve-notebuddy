# Introduction

With PVE NoteBuddy you can use a broad palette of templates for your self-hosted services & adjust them to your needs or create guest notes fully from scratch in a matter of seconds.

## Main Capabilities:

- build note content row-by-row with formatting controls
- easily resize app-icons embedded into your guest notes
- generate copy-ready HTML output for Proxmox notes
- preview how the note will look before copying
- use a large template catalog for self-hosted services
- save and load local template designs in the browser
- the only limit is your imagination (and the 8092 character count in Proxmox VE)

## What It Can't Do

- It's not an automation tool for writing directly to Proxmox via API.
- It's not a server-side CMS or separate infrastructure documentation tool.
- It's not a tool to host your own app-icons for use inside Proxmox

## Core & Security Model

- static frontend javascript application
- no backend
- therefore also no user account system
- no telemetry in the app
- state, templates, designs & settings are stored in your browsers' local storage


::: tip Security Note

Be cautious with unofficial forks that advertise pre-packaged downloads. A fork can change JavaScript behavior and still look visually identical.

Use the official project repository and official GitHub Pages deployment. Be careful with third-party forks that offer downloads or modified builds. A malicious fork can inject unsafe code into a static app.

Official sources:

- GitHub repository: <https://github.com/JangaJones/pve-notebuddy>
- Live app: <https://jangajones.github.io/pve-notebuddy/>

:::
