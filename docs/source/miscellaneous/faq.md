# FAQ
Frequently Asked Questions
## Why does the app not work when opening `index.html` directly?
Because modern browsers block fetch behaviour that is required for template and asset loading to work. Instead of opening the `index.html` with `file://`, serve the app on a [static webserver](../selfhosting/index) and use `http(s)://`. 
## Why is the "Copy-HTML" button disabled?
Your generated output exceeds the PVE supported character limit (8192 chars).
## Where are my templates saved?
In the browser's local storage as part of app state (`pve-notebuddy:state-v1`).
## Is this app safe to use and is the data entered into the app safe/private?
The app is static and client-side by design, only your browser can read what you put into the web-app. Be careful about browser extensions that may have full read access to web pages.
Either way, I would generally advise against putting sensible data (like API Keys, Passwords, SSH Keys, ..) into any website/app or even the Proxmox guest notes itself.
If you are self-hosting, verify source integrity and prefer official project channels.
## Why was my imported icon blocked?
Imported icon URLs are validated against allowed image extensions for safety and consistency.
Additionally `<img>` tags inside the custom notes fields are deactivated on importing a snapshot from a file (edit the note to re-activate the `<img>` tag).
## How do I move my setup to another machine?
Use `Settings -> EXPORT` on source machine and `Settings -> IMPORT` on target machine.
