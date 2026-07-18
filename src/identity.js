// ─── Current user identity ──────────────────────────────────────────────────
// Single source of truth for "who is using this device". Everything else in
// the app should go through these functions instead of touching localStorage
// directly — the day this needs to become a real login (password / magic
// link), only this file changes.

const STORAGE_KEY = 'kg-user'

export function getCurrentUser() {
  return localStorage.getItem(STORAGE_KEY) || null
}

export function setCurrentUser(name) {
  localStorage.setItem(STORAGE_KEY, name)
}

export function clearCurrentUser() {
  localStorage.removeItem(STORAGE_KEY)
}
