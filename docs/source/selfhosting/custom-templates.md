# Custom Templates

You can add your own template JSON files under `templates/custom/` and include them in `templates/index.json`.

## Location

- custom template files: `templates/custom/*.json`
- catalog entry: `templates/index.json`

## Minimal Template Example

```json
{
  "icon": {
    "mode": "external",
    "url": "https://cdn.jsdelivr.net/gh/selfhst/icons@main/svg/example.svg",
    "embedSvg": true,
    "resizeWithWsrv": false,
    "colorVariant": "original"
  },
  "fields": {
    "titleText": "My Service",
    "fqdnLabel": "my-service.local",
    "fqdnUrl": "https://my-service.local",
    "networkText": "Default Port: 8080",
    "configLocations": [
      {
        "icon": "📁",
        "value": "/etc/my-service/"
      }
    ]
  }
}
```

## Index Entry Example

```json
{
  "name": "My Service",
  "file": "custom/my-service.json",
  "source": "custom/my-service.json",
  "tag": "Custom"
}
```

## Team Usage

For multi-user environments, keep a shared repo branch with `templates/custom` and distribute from one controlled source.
