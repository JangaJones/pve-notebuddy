# Linux Setup (Alpine, Debian, Ubuntu)

This section covers a clean-host baseline to serve NoteBuddy as static content.

## 1. Clone Repository

```bash
git clone --branch main https://github.com/JangaJones/pve-notebuddy.git
cd pve-notebuddy
```

## 2. Choose a Static Server

### Alpine quick option (busybox/httpd)

```bash
apk add --no-cache busybox-extras
httpd -f -p 8080 -h /path/to/pve-notebuddy
```

### Debian/Ubuntu quick option (Python)

```bash
apt update
apt install -y python3
cd /path/to/pve-notebuddy
python3 -m http.server 8080
```

### Production option (Nginx)

1. Install Nginx.
2. Set web root to your repo copy.
3. Ensure static files under `resources/` and `templates/` are reachable.
4. Reload Nginx.

## 3. Verify

Open:

- `http://<host>:8080/`

Confirm template search works and loads template JSON files.

## 4. Hardening Suggestions

- run behind TLS reverse proxy
- restrict management network exposure
- use read-only deployment user for static files
