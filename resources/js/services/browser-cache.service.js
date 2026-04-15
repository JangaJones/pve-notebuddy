export function cacheGetItem(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function cacheSetItem(key, value) {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function cacheRemoveItem(key) {
  try {
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
