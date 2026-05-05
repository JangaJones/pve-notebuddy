# FAQ

## Why does the app not work when opening `index.html` directly?

Because modern browsers block fetch behaviour that is required for template and asset loading to work. Instead of opening the `index.html` with `file://`, serve the app on a [static webserver](../selfhosting/index). 

## Why is copy disabled?

Your generated output exceeded the configured length limit (8192 chars).

## Where are my templates saved?

In browser local storage as part of app state (`pve-notebuddy:state-v1`).

## Is this app safe to use online?

The app is static and client-side by design, but always verify source integrity and prefer official project channels.

## Why was my imported icon blocked?

Imported icon URLs are validated against allowed image extensions for safety and consistency.

## How do I move my setup to another machine?

Use `Settings -> EXPORT` on source machine and `Settings -> IMPORT` on target machine.
