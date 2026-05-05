# Should I Self-Host?

What are the benefits of self-hosting? Should you use the GitHub Pages version or setup a local instance of NoteBuddy?

## Decision Matrix

| Situation | GitHub Pages | Self-Host |
| --- | --- | --- |
| **Fast Start & Zero Maintenance** | **Yes** | **No** |
| You want to serve your own custom templates (e.g. in a company) | Maybe | Yes |
| Use behind strict firewalls or even offline segments | No | Yes |
| You need custom reverse proxy/domain policies | No | Yes |
| You want to bundle app with internal tooling | No | Yes |

## My Advice

- Use official GitHub Pages if you just want to use the app and forget about it.
- Self-host if you have policy, networking, or compliance requirements or just want to have fun inside your homelab.

## Operational Tradeoff

Self-hosting gives control, but adds responsibilities:

- patching host OS and web server
- service availability
- security is fully in your own hands

::: tip Update Scripts

I bundled some update scripts with the self-hosted version that allow you to easily:
- fetch & build the latest templates from the community-scripts database
- update the selfh.st image search sidepanel with the latest icons
- update the app itself via the release channel on GitHub

:::
