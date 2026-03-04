<div align="center">
  <img src="resources/favicon.svg" height="80px" alt="PVE NoteBuddy Logo" />
  <h1>PVE NoteBuddy</h1>
  <p><em>Generate pretty Proxmox Guest Notes with a simple web based UI</em></p>

  <p>
    <a href="https://jangajones.github.io/pve-notebuddy/">
      <img src="https://img.shields.io/badge/🔗_PVE_NoteBuddy-Live_on_Github_Pages-6bceea?style=for-the-badge&labelColor=2d3748" alt="Website" />
    </a>
  </p>

 **Search a broad palette of templates for your self-hosted services**  
 and adjust them to your liking or just start from scratch.

</div>

<div align="center">
  <sub>🙌 <strong>Shoutout to</strong></sub>
  <br />
  <br />
  <a href="https://helper-scripts.com">
    <img src="https://img.shields.io/badge/community--scripts-Proxmox_VE_Helper--Scripts-0298a1?style=for-the-badge&labelColor=25787d" alt="Community-Scripts" />
  </a>
  <br />
  <sub><a href="https://github.com/community-scripts/ProxmoxVE">View on GitHub</a> • Used their frontend .jsons to generate template files</sub>
<br />
<br />
  <a href="https://selfh.st/">
    <img src="https://img.shields.io/badge/selfh.st-Icons_for_Self--Hosted-2563eb?style=for-the-badge&labelColor=1e3a8a" alt="selfh.st Icons" />
  </a>
  <br />
  <sub><a href="https://github.com/selfhst/icons">View on GitHub</a> • Consistent, beautiful icons for 5000+ self-hosted apps</sub>
</div>
<br />


# 🚀 Features

- Clean & lightweight, fully client-side app
- Direct HTML-Output copy button, ready to paste to PVE Notes
- Preview pane that displays notes just like the PVE Web UI would (also supports dark/light mode)
- Over 400 templated services (Logo, Website, Default Ports, Default Config Location)
- Directly embed resizable SVGs from local or external sources (fully offline available, no CDN needed, vector quality)
- Option to resize external images via **[wsrv.nl](https://wsrv.nl/)** (Open-Source, uses Cloudflare as CDN)
- Supports **[selfh.st](https://selfh.st/)** icon links natively, you can switch between their icon variants directly from the UI
- Fields for thinks like guest name, FQDN, networking & config paths
- Custom Note field to use for styling or to input additional information (supports **[Markdown](https://www.markdownguide.org/basic-syntax/)** HTML tags)
- Alignment, re-order & text styling options for every field, many possible designs
- Import & export to save your own designs

# 🗒️ Examples

<div align="center">
<p>A collection of screenshots from the preview pane</p>
<p align="middle">
      <img src="screenshots/1.png" width="49.5%" />
      <img src="screenshots/2.png" width="49.5%" />
</p>
<p align="middle">
      <img src="screenshots/3.png" width="49.5%" />
      <img src="screenshots/4.png" width="49.5%" />
</p>
<p align="middle">
      <img src="screenshots/5.png" width="49.5%" />
      <img src="screenshots/6.png" width="49.5%" />
</p>
<p align="middle">
      <img src="screenshots/7.png" width="49.5%" />
      <img src="screenshots/8.png" width="49.5%" />
</p>

</div>


## Crawl-Scripts

In the crawl-scripts folder inside the repo there are are 2 scripts, one to crawl content from the **[community-scripts](https://github.com/community-scripts/ProxmoxVE)** repo (crawl.mjs) and a second script (generate-templates.mjs) to transform the .json files in their repositoy into usable NoteBuddy .json files. Thanks to their curated repo, NoteBuddy is able to provide over 400 service templates with names, icons, website links, default ports & default config locations. 

Massive shoutout to them! 🤝

The crawl-scripts are only needed to commit template updates to this repo and are not used by NoteBuddy itself.

## Local Deployment

PVE NoteBuddy is static & client-side. For local use, deploy the contents of the `main` branch to any static web server, or run a lightweight local server directly from the repository root.

### Option 1: Deploy to a static web server

Clone the repository and serve the project directory with your preferred static hosting solution.

```bash
git clone --branch main https://github.com/JangaJones/pve-notebuddy.git
```

Examples:

- Nginx
- Apache
- Caddy
- any simple static file host

### Option 2: Run a local Python web server

```bash
git clone --branch main https://github.com/JangaJones/pve-notebuddy.git
cd pve-notebuddy
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

### Important

Do **not** open `index.html` directly via `file://`. NoteBuddy won't work as intended this way.

The app loads template JSON files dynamically, and modern browser blocks those local `fetch()` requests when opened directly from disk. This results in template loading failures caused by browser CORS/security restrictions. Use a local or self-hosted static web server instead.

### API & Automation

Currently API & Automation (e.g. automatic publishing to Proxmox or fetching the HTML Output with a GET Request) is not on the table, since this currently exceeds my skillset and would only weaken robustness and security. PVE NoteBuddy will remain separate from Proxmox or automation/deployment tools. This may or may not change in the future.

## Disclaimer

_The recent problems that erupted in the community with vibe-coded apps, specifically regarding security issues are concerning. The app is fully client-sided, there is no backend, no usage telemetry tracking + it's hosted on GitHub Pages. I am definitely categorizing NoteBuddy as safe to visit & use. Still - I want to disclose, that I had assistance from an AI Agent to create & troubleshoot parts of the scripts inside this repository. I used it to write the parser for the the final HTML Output, the SVG embed feature, the scaling feature, the handling of JSON files for import/export as well as the script for template creation. The .html, .css, as well as a portion of the app.js still includes a lot of handwritten code that took many hours and a lot of coffee. The code has been thouroughly reviewed and tested by myself. Be aware, since I am a hobbyist-coder my skills and knowledge are limited, but my decade long non-pro experience with HTML and JS is still not neglegible._

## Thanks

Special thanks to @kenrmayfield for thoughtful feedback, feature ideas, and for helping spread the word about the project.
NoteBuddy is heading in the right direction with all feedback I am currently receiving.
