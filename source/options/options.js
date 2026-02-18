/* global browser */
"use strict";

import { encryptString, decryptString } from "../lib/crypto.js";
import {
  getApiKey, setApiKey, clearApiKey,
  getDomainsCache, setDomainsCache,
  getDefaultDomain, setDefaultDomain, clearDefaultDomain,
  clearLastDomain,
  isLocked, setLocked,
  getApiKeyEncPayload, setApiKeyEncPayload, clearApiKeyEncPayload,
  getOverlayEnabled, setOverlayEnabled,
  getOverlayMode, setOverlayMode,
  getOverlaySites, setOverlaySites,
  normalizeOverlaySiteEntry
} from "../lib/storage.js";

import { getDomains, isLikelyApiKey } from "../lib/api.js";

/* ──────────── DOM ──────────── */

const $ = (id) => document.getElementById(id);

const elKey = $("apiKey");
const elSave = $("save");
const elMsg = $("msg");
const elDefaultDomain = $("defaultDomain");
const elDomainMsg = $("domainMsg");
const elDomainErr = $("domainErr");
const elOverlayEnabled = $("overlayEnabled");
const elOverlayMode = $("overlayMode");
const elOverlaySettings = $("overlaySettings");
const elSiteListSection = $("siteListSection");
const elSiteInput = $("siteInput");
const elBtnAddSite = $("btnAddSite");
const elSiteList = $("siteList");
const elOverlayMsg = $("overlayMsg");
const elBtnDisconnect = $("btnDisconnect");
const elDangerMsg = $("dangerMsg");

const els = {
  lockPassword: $("lockPassword"),
  lockPassword2: $("lockPassword2"),
  btnEnableLock: $("btnEnableLock"),
  btnLockNow: $("btnLockNow"),
  disablePassword: $("disablePassword"),
  btnDisableLock: $("btnDisableLock"),
  secMsg: $("secMsg"),
  secErr: $("secErr"),
};

function show(el) { el?.classList.remove("hidden"); }
function hide(el) { el?.classList.add("hidden"); }

function toast(el, msg, ms = 2500) {
  if (!el) return;
  if (!msg) { el.textContent = ""; hide(el); return; }
  el.textContent = String(msg);
  show(el);
  setTimeout(() => toast(el, ""), ms);
}

function setErr(el, msg) {
  if (!el) return;
  if (!msg) { el.textContent = ""; hide(el); return; }
  el.textContent = String(msg);
  show(el);
}

function norm(v) { return String(v || "").trim().toLowerCase(); }

async function setBgSessionKey(apiKey) {
  await browser.runtime.sendMessage({ type: "MAM_SET_SESSION_KEY", apiKey });
}
async function clearBgSessionKey() {
  await browser.runtime.sendMessage({ type: "MAM_CLEAR_SESSION_KEY" });
}

/* ──────────── Default Domain ──────────── */

function fillDomainSelect(domains) {
  if (!elDefaultDomain) return;
  elDefaultDomain.textContent = "";

  const optNone = document.createElement("option");
  optNone.value = "";
  optNone.textContent = "Use last selection";
  elDefaultDomain.appendChild(optNone);

  for (const d of Array.from(new Set(domains))) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    elDefaultDomain.appendChild(opt);
  }
}

async function loadDomains() {
  try {
    const domains = await getDomains();
    if (Array.isArray(domains) && domains.length) {
      await setDomainsCache(domains);
      return domains;
    }
  } catch (e) {
    const cache = await getDomainsCache();
    if (cache?.items?.length) return cache.items;
    throw e;
  }
  const cache = await getDomainsCache();
  return cache?.items || [];
}

async function initDefaultDomain() {
  if (!elDefaultDomain) return;
  try {
    setErr(elDomainErr, "");
    const domains = await loadDomains();
    fillDomainSelect(domains);
    const saved = norm(await getDefaultDomain());
    if (saved && domains.includes(saved)) elDefaultDomain.value = saved;
    else elDefaultDomain.value = "";
  } catch (e) {
    setErr(elDomainErr, e.message || "Failed to load domains.");
  }

  elDefaultDomain.addEventListener("change", async () => {
    try {
      setErr(elDomainErr, "");
      const v = norm(elDefaultDomain.value);
      if (!v) { await clearDefaultDomain(); toast(elDomainMsg, "Default domain cleared."); return; }
      await setDefaultDomain(v);
      toast(elDomainMsg, "Default domain saved.");
    } catch (e) {
      setErr(elDomainErr, e.message);
    }
  });
}

/* ──────────── API Key ──────────── */

async function initApiKey() {
  const locked = await isLocked();
  elKey.value = locked ? "" : norm(await getApiKey());
  elKey.placeholder = locked ? "Lock enabled — key not stored in plaintext" : "64 characters (a–z, 0–9)";

  elSave.addEventListener("click", async () => {
    try {
      const lockedNow = await isLocked();
      if (lockedNow) { toast(elMsg, "Disable the lock before changing the key."); return; }
      const k = norm(elKey.value);
      if (!k) return toast(elMsg, "Key is empty.");
      if (!isLikelyApiKey(k)) return toast(elMsg, "Invalid key (expected 64 hex chars).");
      await setApiKey(k);
      await setBgSessionKey(k);
      toast(elMsg, "API key saved.");
    } catch (e) {
      toast(elMsg, e.message || "Failed to save.");
    }
  });
}

/* ──────────── Overlay ──────────── */

let currentSites = [];

function shortenMiddle(value, max = 64) {
  const text = String(value || "");
  if (text.length <= max) return text;
  const side = Math.floor((max - 3) / 2);
  return `${text.slice(0, side)}...${text.slice(text.length - side)}`;
}

function getOverlaySitePresentation(siteKey) {
  const site = String(siteKey || "");
  if (site.startsWith("host:")) {
    const host = site.slice(5);
    return { main: host, detail: "Web domain" };
  }
  if (site.startsWith("file://")) {
    const path = site.slice("file://".length);
    let decodedPath = "";
    if (path) {
      try { decodedPath = decodeURIComponent(path); } catch { decodedPath = path; }
    }
    return { main: "Local file (file://)", detail: shortenMiddle(decodedPath || path || "/") };
  }
  if (site.startsWith("about:")) {
    const target = site.slice("about:".length) || "(root)";
    return { main: "Browser page (about:)", detail: target };
  }
  if (site.startsWith("moz-extension://")) {
    return { main: "Extension page (moz-extension://)", detail: shortenMiddle(site.slice("moz-extension://".length)) };
  }
  if (site.startsWith("chrome-extension://")) {
    return { main: "Extension page (chrome-extension://)", detail: shortenMiddle(site.slice("chrome-extension://".length)) };
  }
  return { main: site, detail: "" };
}

function renderSiteList() {
  if (!elSiteList) return;
  elSiteList.textContent = "";

  const visibleSites = currentSites.filter(Boolean);
  if (visibleSites.length !== currentSites.length) {
    currentSites = visibleSites;
  }

  for (const site of currentSites) {
    const presentation = getOverlaySitePresentation(site);
    if (!presentation.main) continue;

    const li = document.createElement("li");
    const textWrap = document.createElement("div");
    textWrap.className = "site-text";

    const main = document.createElement("div");
    main.className = "site-main";
    main.textContent = presentation.main;
    textWrap.appendChild(main);

    if (presentation.detail) {
      const detail = document.createElement("div");
      detail.className = "site-detail";
      detail.textContent = presentation.detail;
      textWrap.appendChild(detail);
    }

    const btn = document.createElement("button");
    btn.className = "btn-remove";
    btn.textContent = "×";
    btn.title = `Remove ${presentation.main}`;
    btn.setAttribute("aria-label", `Remove ${presentation.main}`);
    btn.addEventListener("click", async () => {
      currentSites = currentSites.filter(s => s !== site);
      await setOverlaySites(currentSites);
      currentSites = await getOverlaySites();
      renderSiteList();
      toast(elOverlayMsg, `Removed ${presentation.main}`);
    });
    li.appendChild(textWrap);
    li.appendChild(btn);
    elSiteList.appendChild(li);
  }
}

async function initOverlay() {
  // Enabled toggle
  const enabled = await getOverlayEnabled();
  if (elOverlayEnabled) elOverlayEnabled.checked = enabled;
  if (!enabled) hide(elOverlaySettings);

  elOverlayEnabled?.addEventListener("change", async () => {
    const v = elOverlayEnabled.checked;
    await setOverlayEnabled(v);
    if (v) show(elOverlaySettings); else hide(elOverlaySettings);
    toast(elOverlayMsg, v ? "Overlay enabled." : "Overlay disabled.");
  });

  // Mode
  const mode = await getOverlayMode();
  if (elOverlayMode) elOverlayMode.value = mode;
  if (mode !== "all") show(elSiteListSection);

  elOverlayMode?.addEventListener("change", async () => {
    const v = elOverlayMode.value;
    await setOverlayMode(v);
    if (v === "all") hide(elSiteListSection); else show(elSiteListSection);
    toast(elOverlayMsg, "Filter mode updated.");
  });

  // Site list
  currentSites = await getOverlaySites();
  renderSiteList();

  elBtnAddSite?.addEventListener("click", async () => {
    const raw = String(elSiteInput?.value || "").trim();
    if (!raw) return;

    const siteKey = normalizeOverlaySiteEntry(raw);
    if (!siteKey) {
      toast(elOverlayMsg, "Enter a valid domain or URL.");
      return;
    }

    if (currentSites.includes(siteKey)) {
      toast(elOverlayMsg, "Already in list.");
      return;
    }

    currentSites.push(siteKey);
    await setOverlaySites(currentSites);
    currentSites = await getOverlaySites();
    renderSiteList();
    if (elSiteInput) elSiteInput.value = "";
    toast(elOverlayMsg, `Added ${getOverlaySitePresentation(siteKey).main}`);
  });

  elSiteInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") elBtnAddSite?.click();
  });
}

/* ──────────── Security ──────────── */

async function enableLockFlow() {
  try {
    setErr(els.secErr, "");
    const p1 = els.lockPassword?.value || "";
    const p2 = els.lockPassword2?.value || "";
    if (p1.length < 8) return setErr(els.secErr, "Password must be at least 8 characters.");
    if (p1 !== p2) return setErr(els.secErr, "Passwords do not match.");

    const apiKeyPlain = norm(await getApiKey());
    if (!apiKeyPlain) return setErr(els.secErr, "Save an API key first.");
    if (!isLikelyApiKey(apiKeyPlain)) return setErr(els.secErr, "Invalid API key in storage.");

    const payload = await encryptString(apiKeyPlain, p1);
    await setApiKeyEncPayload(payload);
    await setLocked(true);
    await browser.storage.local.remove("apiKey");
    await setBgSessionKey(apiKeyPlain);

    if (els.lockPassword) els.lockPassword.value = "";
    if (els.lockPassword2) els.lockPassword2.value = "";
    toast(els.secMsg, "Lock enabled. Key is now encrypted.");
  } catch (e) {
    setErr(els.secErr, e.message || "Failed to enable lock.");
  }
}

async function lockNowFlow() {
  await clearBgSessionKey();
  toast(els.secMsg, "Session locked.");
}

async function disableLockFlow() {
  try {
    setErr(els.secErr, "");
    const pass = els.disablePassword?.value || "";
    if (pass.length < 6) return setErr(els.secErr, "Password too short.");

    const payload = await getApiKeyEncPayload();
    if (!payload) return setErr(els.secErr, "No encrypted key found.");

    const apiKeyPlain = norm(await decryptString(payload, pass));
    if (!isLikelyApiKey(apiKeyPlain)) return setErr(els.secErr, "Incorrect password.");

    await setApiKey(apiKeyPlain);
    await clearApiKeyEncPayload();
    await setLocked(false);
    await setBgSessionKey(apiKeyPlain);

    if (els.disablePassword) els.disablePassword.value = "";
    toast(els.secMsg, "Lock disabled. Key stored in plaintext.");
  } catch (e) {
    setErr(els.secErr, e.message || "Failed to disable lock.");
  }
}

async function initSecurity() {
  els.btnEnableLock?.addEventListener("click", enableLockFlow);
  els.btnLockNow?.addEventListener("click", lockNowFlow);
  els.btnDisableLock?.addEventListener("click", disableLockFlow);
}

/* ──────────── Danger Zone ──────────── */

function initDangerZone() {
  elBtnDisconnect?.addEventListener("click", async () => {
    if (!confirm("Disconnect? This removes your API key and all local settings. Your aliases on the server are not affected.")) return;
    await clearBgSessionKey();
    await clearApiKey();
    await clearLastDomain();
    await clearDefaultDomain();
    toast(elDangerMsg, "Disconnected. Reload the extension to reconnect.");
  });
}

/* ──────────── Boot ──────────── */

(async function init() {
  await initApiKey();
  await initDefaultDomain();
  await initOverlay();
  await initSecurity();
  initDangerZone();
})();
