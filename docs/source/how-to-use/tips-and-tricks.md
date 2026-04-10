# Tips and Tricks

## Use Additional Notes for Structured Content

Custom notes can include safe HTML elements after sanitization.

Useful examples:

- line breaks: `<br>`
- lists: `<ul><li>...</li></ul>`
- inline code: `<code>/etc/service/config.yml</code>`
- links: `<a href="https://example.com">Docs</a>`

## Keep Notes Operationally Useful

A high-value note usually includes:

- what the service is
- where to reach it
- which port(s) matter
- where config/data lives
- one-line troubleshooting clue

## Prefer Consistent Layouts

Use one of the design presets as a baseline, then only tweak what differs per service. This keeps your Proxmox notes scannable.

## Save Reusable Local Templates

If you repeatedly create similar entries, save the current state in Local Templates and reload as starting point.

## Validate Before Copy

Always check:

- final row order
- hidden rows not accidentally omitted
- character limit status
