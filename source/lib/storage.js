// lib/storage.js
/* global browser */
"use strict";

const KEY_API_KEY = "apiKey";
const KEY_DOMAINS_CACHE = "domainsCache";
const KEY_LAST_DOMAIN = "lastDomain";
const KEY_DEFAULT_DOMAIN = "defaultDomain";
const KEY_UI_MODE = "uiMode"; // "buttons" | "icon"
const KEY_LOCKED = "locked";
const KEY_API_KEY_ENC = "apiKeyEncPayload";
const KEY_FAVORITE_DOMAINS = "favoriteDomains";
const KEY_OVERLAY_MODE = "overlayMode";
const KEY_OVERLAY_SITES = "overlaySites";
const KEY_OVERLAY_ENABLED = "overlayEnabled";
const KEY_SKIP_DELETE_CONFIRM = "skipDeleteConfirm";
const KEY_HANDLE_STYLE = "handleStyle";
const KEY_HAS_SELECTED_DOMAIN = "hasSelectedDomain";

function normalizeHost(rawHost) {
  const host = String(rawHost || "")
    .trim()
    .toLowerCase()
    .replace(/\.+$/g, "");

  if (!host) return "";
  if (host === "null" || host === "undefined") return "";
  if (!/^[a-z0-9.-]+$/.test(host)) return "";
  if (host.startsWith(".") || host.endsWith(".") || host.includes("..")) return "";
  return host;
}

function toSpecialSiteKey(url) {
  const protocol = String(url.protocol || "").toLowerCase();
  const host = normalizeHost(url.hostname);
  const pathname = url.pathname || "";

  if (protocol === "about:") {
    const tail = String(pathname || url.href.slice("about:".length) || "").trim();
    return tail ? `about:${tail}` : "";
  }

  if (host) return `${protocol}//${host}${pathname}`;
  if (pathname) return `${protocol}${pathname}`;
  return protocol;
}

export function normalizeOverlaySiteEntry(rawValue) {
  if (typeof rawValue !== "string") return "";
  const raw = rawValue.trim();
  if (!raw) return "";

  const lower = raw.toLowerCase();
  if (lower === "null" || lower === "undefined") return "";

  if (lower.startsWith("host:")) {
    const host = normalizeHost(raw.slice(5));
    return host ? `host:${host}` : "";
  }

  if (/^[a-z0-9.-]+$/i.test(raw)) {
    const host = normalizeHost(raw);
    return host ? `host:${host}` : "";
  }

  let parsedUrl = null;
  try {
    parsedUrl = new URL(raw);
  } catch {
    try {
      parsedUrl = new URL(`https://${raw}`);
    } catch {
      return "";
    }
  }

  const protocol = String(parsedUrl.protocol || "").toLowerCase();
  if (protocol === "http:" || protocol === "https:") {
    const host = normalizeHost(parsedUrl.hostname);
    return host ? `host:${host}` : "";
  }

  if (protocol === "file:") {
    const path = parsedUrl.pathname || "";
    return path ? `file://${path}` : "";
  }

  return toSpecialSiteKey(parsedUrl);
}

function sameValues(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function normalizeOverlaySites(rawSites) {
  if (!Array.isArray(rawSites)) return [];
  const out = [];
  const seen = new Set();
  for (const value of rawSites) {
    const normalized = normalizeOverlaySiteEntry(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}


export async function getApiKey() {
  const res = await browser.storage.local.get(KEY_API_KEY);
  return res[KEY_API_KEY] || "";
}

export async function setApiKey(apiKey) {
  await browser.storage.local.set({ [KEY_API_KEY]: apiKey });
}

export async function clearApiKey() {
  await browser.storage.local.remove([KEY_API_KEY, KEY_API_KEY_ENC, KEY_LOCKED, KEY_LAST_DOMAIN, KEY_HAS_SELECTED_DOMAIN]);
}

export async function getDomainsCache() {
  const res = await browser.storage.local.get(KEY_DOMAINS_CACHE);
  return res[KEY_DOMAINS_CACHE] || null; // { ts:number, items:string[] }
}

export async function setDomainsCache(items) {
  await browser.storage.local.set({
    [KEY_DOMAINS_CACHE]: { ts: Date.now(), items }
  });
}

export async function clearDomainsCache() {
  await browser.storage.local.remove(KEY_DOMAINS_CACHE);
}

export async function getLastDomain() {
  const res = await browser.storage.local.get(KEY_LAST_DOMAIN);
  return res[KEY_LAST_DOMAIN] || "";
}

export async function setLastDomain(domain) {
  await browser.storage.local.set({ [KEY_LAST_DOMAIN]: domain });
}

export async function clearLastDomain() {
  await browser.storage.local.remove([KEY_LAST_DOMAIN, KEY_HAS_SELECTED_DOMAIN]);
}

export async function hasSelectedDomain() {
  const res = await browser.storage.local.get(KEY_HAS_SELECTED_DOMAIN);
  return Boolean(res[KEY_HAS_SELECTED_DOMAIN]);
}

export async function setHasSelectedDomain(v = true) {
  await browser.storage.local.set({ [KEY_HAS_SELECTED_DOMAIN]: Boolean(v) });
}

export async function clearHasSelectedDomain() {
  await browser.storage.local.remove(KEY_HAS_SELECTED_DOMAIN);
}

export async function getDefaultDomain() {
  const res = await browser.storage.local.get(KEY_DEFAULT_DOMAIN);
  return res[KEY_DEFAULT_DOMAIN] || "";
}

export async function setDefaultDomain(domain) {
  await browser.storage.local.set({ [KEY_DEFAULT_DOMAIN]: domain });
}

export async function clearDefaultDomain() {
  await browser.storage.local.remove(KEY_DEFAULT_DOMAIN);
}

export async function getUiMode() {
  const res = await browser.storage.local.get(KEY_UI_MODE);
  return res[KEY_UI_MODE] || "icon"; // default: method 2
}

export async function setUiMode(mode) {
  await browser.storage.local.set({ [KEY_UI_MODE]: mode });
}

export async function isLocked() {
  const res = await browser.storage.local.get(KEY_LOCKED);
  return Boolean(res[KEY_LOCKED]);
}

export async function setLocked(v) {
  await browser.storage.local.set({ [KEY_LOCKED]: Boolean(v) });
}

export async function getApiKeyEncPayload() {
  const res = await browser.storage.local.get(KEY_API_KEY_ENC);
  return res[KEY_API_KEY_ENC] || null;
}

export async function setApiKeyEncPayload(payload) {
  await browser.storage.local.set({ [KEY_API_KEY_ENC]: payload });
}

export async function clearApiKeyEncPayload() {
  await browser.storage.local.remove(KEY_API_KEY_ENC);
}

// ━━━ Favorite Domains ━━━

export async function getFavoriteDomains() {
  const res = await browser.storage.local.get(KEY_FAVORITE_DOMAINS);
  return res[KEY_FAVORITE_DOMAINS] || [];
}

export async function setFavoriteDomains(domains) {
  await browser.storage.local.set({ [KEY_FAVORITE_DOMAINS]: domains });
}

export async function toggleFavoriteDomain(domain) {
  const favs = await getFavoriteDomains();
  const idx = favs.indexOf(domain);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(domain);
  await setFavoriteDomains(favs);
  return favs;
}

// ━━━ Overlay settings ━━━

export async function getOverlayMode() {
  const res = await browser.storage.local.get(KEY_OVERLAY_MODE);
  return res[KEY_OVERLAY_MODE] || "all";
}

export async function setOverlayMode(mode) {
  await browser.storage.local.set({ [KEY_OVERLAY_MODE]: mode });
}

export async function getOverlaySites() {
  const res = await browser.storage.local.get(KEY_OVERLAY_SITES);
  const raw = Array.isArray(res[KEY_OVERLAY_SITES]) ? res[KEY_OVERLAY_SITES] : [];
  const normalized = normalizeOverlaySites(raw);
  if (!sameValues(raw, normalized)) {
    await browser.storage.local.set({ [KEY_OVERLAY_SITES]: normalized });
  }
  return normalized;
}

export async function setOverlaySites(sites) {
  const normalized = normalizeOverlaySites(sites);
  await browser.storage.local.set({ [KEY_OVERLAY_SITES]: normalized });
}

export async function getOverlayEnabled() {
  const res = await browser.storage.local.get(KEY_OVERLAY_ENABLED);
  return res[KEY_OVERLAY_ENABLED] !== false;
}

export async function setOverlayEnabled(v) {
  await browser.storage.local.set({ [KEY_OVERLAY_ENABLED]: Boolean(v) });
}

// ━━━ Delete confirmation ━━━

export async function getSkipDeleteConfirm() {
  const res = await browser.storage.local.get(KEY_SKIP_DELETE_CONFIRM);
  return Boolean(res[KEY_SKIP_DELETE_CONFIRM]);
}

export async function setSkipDeleteConfirm(v) {
  await browser.storage.local.set({ [KEY_SKIP_DELETE_CONFIRM]: Boolean(v) });
}

// ━━━ Handle style ━━━

export async function getHandleStyle() {
  const res = await browser.storage.local.get(KEY_HANDLE_STYLE);
  return res[KEY_HANDLE_STYLE] || "readable";
}

export async function setHandleStyle(style) {
  await browser.storage.local.set({ [KEY_HANDLE_STYLE]: style });
}
