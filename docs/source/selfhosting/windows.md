# Windows Setup

## 1. Install Prerequisites

- Git for Windows
- Python 3 (or Node.js if you prefer a Node-based static server)

## 2. Clone and Serve

```powershell
git clone --branch main https://github.com/JangaJones/pve-notebuddy.git
cd pve-notebuddy
python -m http.server 8080
```

## 3. Open App

- `http://localhost:8080/`

## 4. Service Options

For persistent background hosting on Windows:

- use NSSM or Task Scheduler to run your static server command on boot
- or use IIS/Nginx for a more standard web-server deployment

## Fresh Install Checklist

- install updates and drivers
- install runtime tools
- verify firewall rules for chosen port
- verify template loading over HTTP
