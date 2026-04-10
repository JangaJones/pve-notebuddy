# Should I Self-Host?

Use this matrix to decide whether self-hosting PVE NoteBuddy is worth it for your setup.

## Decision Matrix

| Situation | Use Official GitHub Pages | Self-Host |
| --- | --- | --- |
| You want fastest start | Yes | No |
| You are behind strict firewalls or offline segments | No | Yes |
| You need full control over update timing | Maybe | Yes |
| You need custom reverse proxy/domain policies | No | Yes |
| You want zero maintenance | Yes | No |
| You want to bundle app with internal tooling | No | Yes |

## Rule of Thumb

- Use official GitHub Pages if you just want to use the app.
- Self-host if you have policy, networking, or compliance requirements.

## Operational Tradeoff

Self-hosting gives control, but adds responsibilities:

- patching host OS and web server
- monitoring service availability
- validating updates before rollout
- handling backups and restore of host configuration

## Hybrid Approach

Some users run both:

- official site for quick access
- internal self-hosted mirror for controlled environments
