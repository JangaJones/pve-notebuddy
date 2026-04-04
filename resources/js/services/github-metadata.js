export function createGithubMetadataService({
  refs,
  appVersion,
  githubStarsCacheTtlMs,
  githubReleaseCacheTtlMs,
  fetchJsonWithCache,
}) {
  function normalizeVersion(version) {
    return String(version || "")
      .trim()
      .replace(/^v/i, "");
  }

  function compareVersions(a, b) {
    const left = normalizeVersion(a).split(/[.-]/);
    const right = normalizeVersion(b).split(/[.-]/);
    const maxLength = Math.max(left.length, right.length);

    for (let index = 0; index < maxLength; index += 1) {
      const leftPart = left[index] ?? "0";
      const rightPart = right[index] ?? "0";
      const leftNumber = Number.parseInt(leftPart, 10);
      const rightNumber = Number.parseInt(rightPart, 10);
      const bothNumeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);

      if (bothNumeric) {
        if (leftNumber > rightNumber) {
          return 1;
        }
        if (leftNumber < rightNumber) {
          return -1;
        }
        continue;
      }

      const comparison = leftPart.localeCompare(rightPart, undefined, { numeric: true, sensitivity: "base" });
      if (comparison !== 0) {
        return comparison;
      }
    }

    return 0;
  }

  function setVersionStatus(message, tone = "pending") {
    if (!refs.appVersionStatusEl) {
      return;
    }

    refs.appVersionStatusEl.textContent = message;
    refs.appVersionStatusEl.className = `footer-status footer-status-${tone}`;
  }

  async function loadGithubStarCount() {
    if (!refs.githubStarCountEl) {
      return;
    }

    refs.githubStarCountEl.textContent = "--";

    try {
      const data = await fetchJsonWithCache({
        url: "https://api.github.com/repos/JangaJones/pve-notebuddy",
        cacheKey: "pve-notebuddy:github:repo",
        ttlMs: githubStarsCacheTtlMs,
      });
      const stars = Number.parseInt(String(data?.stargazers_count ?? ""), 10);
      if (!Number.isFinite(stars)) {
        return;
      }

      refs.githubStarCountEl.textContent = new Intl.NumberFormat("en-US").format(stars);
    } catch {
      // Keep fallback display when API is unavailable or rate-limited.
    }
  }

  async function loadReleaseVersionStatus() {
    if (refs.appVersionValueEl) {
      refs.appVersionValueEl.textContent = appVersion;
    }
    setVersionStatus("Checking latest release...", "pending");

    try {
      const data = await fetchJsonWithCache({
        url: "https://api.github.com/repos/JangaJones/pve-notebuddy/releases/latest",
        cacheKey: "pve-notebuddy:github:latest-release",
        ttlMs: githubReleaseCacheTtlMs,
      });
      const latestTag = normalizeVersion(data?.tag_name);
      const releaseUrl = typeof data?.html_url === "string" && data.html_url ? data.html_url : "";

      if (refs.appVersionStatusEl && releaseUrl) {
        refs.appVersionStatusEl.href = releaseUrl;
      }

      if (!latestTag) {
        setVersionStatus("Latest release could not be determined.", "error");
        return;
      }

      const comparison = compareVersions(appVersion, latestTag);
      if (comparison < 0) {
        setVersionStatus(`Update available: ${latestTag}`, "stale");
        return;
      }

      if (comparison > 0) {
        setVersionStatus(`Newer than ${latestTag}`, "ok");
        return;
      }

      setVersionStatus("Up to Date", "ok");
    } catch {
      setVersionStatus("Release check unavailable.", "error");
    }
  }

  return {
    loadGithubStarCount,
    loadReleaseVersionStatus,
  };
}
