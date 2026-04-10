# macOS Setup

## 1. Install Base Tools

Install Homebrew (if missing), then:

```bash
brew install git node
```

## 2. Clone and Serve

```bash
git clone --branch main https://github.com/JangaJones/pve-notebuddy.git
cd pve-notebuddy
python3 -m http.server 8080
```

## 3. Open App

- `http://localhost:8080/`

## 4. Optional Launch Agent

For permanent hosting, run behind Nginx/Caddy or create a `launchd` service for your chosen static server command.

## Fresh Install Checklist

- apply OS updates
- install Xcode Command Line Tools
- install server runtime/tooling
- clone repository and test template loading
