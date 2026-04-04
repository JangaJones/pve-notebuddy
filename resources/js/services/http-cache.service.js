import { storageGetItem, storageSetItem } from "./storage.service.js";

export function fetchWithPrivacy(url, options = {}) {
  return fetch(url, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
    ...options,
  });
}

function readCacheEntry(key) {
  try {
    const raw = storageGetItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.fetchedAt !== "number" || !("data" in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCacheEntry(key, data) {
  storageSetItem(
    key,
    JSON.stringify({
      fetchedAt: Date.now(),
      data,
    })
  );
}

export async function fetchJsonWithCache({ url, cacheKey, ttlMs }) {
  const now = Date.now();
  const cached = readCacheEntry(cacheKey);
  if (cached && now - cached.fetchedAt <= ttlMs) {
    return cached.data;
  }

  try {
    const res = await fetchWithPrivacy(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    writeCacheEntry(cacheKey, data);
    return data;
  } catch {
    if (cached) {
      return cached.data;
    }
    throw new Error("Cache miss and fetch failed.");
  }
}
