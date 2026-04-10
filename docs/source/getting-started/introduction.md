# Introduction

PVE NoteBuddy helps you create clean, readable Proxmox VE notes using a visual editor instead of manually writing HTML.

## What It Does

Main capabilities:

- build note content row-by-row with formatting controls
- generate copy-ready HTML output for Proxmox notes
- preview how the note will look before copying
- use a large template catalog for self-hosted services
- save and load local template designs in the browser
- manage icon behavior (embed, gallery, upload, resize)

## Core Architecture and Security Model

PVE NoteBuddy is a static frontend application:

- no backend required
- no user account system
- no telemetry pipeline in the app
- state is stored in browser local storage

Because it is static and client-side, where you get the files from matters.

## Security Warning About Forks and Downloads

Be cautious with unofficial forks that advertise pre-packaged downloads. A fork can change JavaScript behavior and still look visually identical.

Recommended practice:

1. Use the official repository.
2. Use the official GitHub Pages deployment.
3. If you self-host, deploy from your own clone of the official source.
4. Review diffs before pulling from any third-party branch.

## What PVE NoteBuddy Is Not

- It is not an automation tool for writing directly to Proxmox via API.
- It is not a server-side CMS.
- It does not replace your own operational security process.
