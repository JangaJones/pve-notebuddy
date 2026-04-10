# Proxmox LXC (Install Script)

A Proxmox LXC install script with optional auto-update flow is planned for the `/scripts` directory.

## Intended Flow

1. Run script on Proxmox host.
2. Script provisions container and static host dependencies.
3. App files are deployed into container web root.
4. Optional update hook pulls latest app files and restarts web service.

## Status

Work in progress.

Until the script is published, use the standard Linux instructions and deploy manually inside an LXC container.

## Operational Notes

- pin updates in production environments
- snapshot container before major updates
- keep template customizations backed up outside container
