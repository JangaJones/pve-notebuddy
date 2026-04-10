# weserv/images and wsrv.nl

NoteBuddy can resize remote icons through the weserv/images service.

## Why It Exists

Resizing/caching helps when:

- source images are too large
- source hosts are slow
- you want consistent icon dimensions

## Default Behavior

By default, NoteBuddy uses `https://wsrv.nl/`.

## Why Self-Host weserv/images

Self-hosting may make sense when you need:

- internal-only traffic flow
- predictable privacy boundaries
- custom caching and retention policies
- independence from public service availability

## In-App Integration

Set your own base URL in Settings, then resize mode uses your domain instead of `wsrv.nl`.
