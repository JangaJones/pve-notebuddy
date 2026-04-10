# Docker (Work in Progress)

A bundled Docker Compose profile for NoteBuddy plus `weserv/images` is planned.

## Current Direction

- serve NoteBuddy static files from a lightweight web container
- optionally run `weserv/images` as sidecar service
- expose app and resize endpoint via reverse proxy

## Example Skeleton

```yaml
services:
  notebuddy:
    image: nginx:alpine
    volumes:
      - ./pve-notebuddy:/usr/share/nginx/html:ro
    ports:
      - "8080:80"

  weserv:
    # placeholder; pick image/repo based on your preferred weserv/images deployment
    image: ghcr.io/weserv/images:latest
    ports:
      - "8081:80"
```

## Note

Treat this as a draft until an official, tested compose file is added to the repository.
