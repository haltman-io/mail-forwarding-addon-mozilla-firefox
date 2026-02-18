/* global browser */
"use strict";

import {
  getApiKey, setApiKey,
  getDomainsCache, setDomainsCache,
  getLastDomain, setLastDomain,
  hasSelectedDomain, setHasSelectedDomain,
  getDefaultDomain,
  isLocked, getApiKeyEncPayload,
  getFavoriteDomains, toggleFavoriteDomain,
  getHandleStyle, setHandleStyle
} from "../lib/storage.js";

import { decryptString } from "../lib/crypto.js";
import { isLikelyApiKey } from "../lib/api.js";

/* ═══════════════════ DOM refs ═══════════════════ */

const $ = (id) => document.getElementById(id);

const el = {
  snackbar: $("snackbar"),

  // views
  viewConnect: $("viewConnect"),
  viewConnected: $("viewConnected"),
  viewUnlock: $("viewUnlock"),
  viewMain: $("viewMain"),

  // header
  btnLock: $("btnLock"),
  btnRefresh: $("btnRefresh"),
  btnSettings: $("btnSettings"),

  // connect
  connectKeyInput: $("connectKeyInput"),
  connectKeyHint: $("connectKeyHint"),
  btnConnect: $("btnConnect"),
  btnConnectText: $("btnConnectText"),
  btnConnectSpinner: $("btnConnectSpinner"),
  connectErr: $("connectErr"),

  // credentials request
  credentialEmail: $("credentialEmail"),
  credentialEmailHint: $("credentialEmailHint"),
  credentialDays: $("credentialDays"),
  credentialDaysHint: $("credentialDaysHint"),
  btnRequestKey: $("btnRequestKey"),
  btnRequestKeyText: $("btnRequestKeyText"),
  btnRequestKeySpinner: $("btnRequestKeySpinner"),
  credentialSuccess: $("credentialSuccess"),
  credentialErr: $("credentialErr"),

  // connected
  btnStartUsing: $("btnStartUsing"),
  btnSetupLock: $("btnSetupLock"),

  // unlock
  unlockPassword: $("unlockPassword"),
  btnUnlock: $("btnUnlock"),
  unlockErr: $("unlockErr"),

  // main
  mainLoading: $("mainLoading"),
  tabGenerate: $("tabGenerate"),
  tabChoose: $("tabChoose"),
  tabChooseCount: $("tabChooseCount"),
  appErr: $("appErr"),

  // generate
  panelGenerate: $("panelGenerate"),
  domainCombobox: $("domainCombobox"),
  domainInput: $("domainInput"),
  domainDropdown: $("domainDropdown"),
  domainRequiredHint: $("domainRequiredHint"),
  btnGenerateCopy: $("btnGenerateCopy"),
  btnGenText: $("btnGenText"),
  btnGenSpinner: $("btnGenSpinner"),
  btnMoreOptions: $("btnMoreOptions"),
  moreOptions: $("moreOptions"),
  toggleReadable: $("toggleReadable"),
  toggleRandom: $("toggleRandom"),
  customHandle: $("customHandle"),
  customHandleHint: $("customHandleHint"),
  handlePreview: $("handlePreview"),
  btnCreateCustom: $("btnCreateCustom"),

  // choose
  panelChoose: $("panelChoose"),
  searchInput: $("searchInput"),
  chooseMeta: $("chooseMeta"),
  aliasListShell: $("aliasListShell"),
  aliasList: $("aliasList"),
  emptyState: $("emptyState"),
  btnEmptyGenerate: $("btnEmptyGenerate"),

  // delete modal
  deleteModal: $("deleteModal"),
  deleteModalAlias: $("deleteModalAlias"),
  btnDeleteCancel: $("btnDeleteCancel"),
  btnDeleteConfirm: $("btnDeleteConfirm"),
};

/* ═══════════════════ State ═══════════════════ */

let DOMAINS = [];
let ALIASES = [];
let ALIASES_TOTAL = 0;
let selectedDomain = "";
let handleStyle = "readable"; // "readable" | "random"
let pendingDeleteAddress = "";
let comboboxOpen = false;
let comboboxVisibleDomains = [];
let comboboxHighlightIndex = -1;
let comboboxRenderToken = 0;
let aliasListWired = false;
let isGenerating = false;

const CUSTOM_HANDLE_MAX_LEN = 64;
const CUSTOM_HANDLE_ALLOWED_RE = /^[a-z0-9._-]+$/;

/* ═══════════════════ Utilities ═══════════════════ */

const show = (e) => { if (e) e.classList.remove("hidden"); };
const hide = (e) => { if (e) e.classList.add("hidden"); };
const norm = (s) => (s || "").trim().toLowerCase();
const formatCount = (n) => new Intl.NumberFormat().format(Math.max(0, Number(n) || 0));

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Create an SVG element tree from a declarative spec, without innerHTML.
 * @param {string} tag - SVG element tag name
 * @param {Object} attrs - attribute key/value pairs
 * @param {Array}  children - child specs: each is [tag, attrs, children?]
 * @returns {SVGElement}
 */
function svgEl(tag, attrs = {}, children = []) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.appendChild(svgEl(c[0], c[1] || {}, c[2] || []));
  return el;
}

function makeCopyIcon() {
  return svgEl("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }, [
    ["rect", { x: "9", y: "9", width: "13", height: "13", rx: "2" }],
    ["path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }]
  ]);
}

function makeTrashIcon() {
  return svgEl("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }, [
    ["path", { d: "M3 6h18" }],
    ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" }],
    ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" }]
  ]);
}

function setErr(target, msg) {
  if (!target) return;
  if (!msg) { target.textContent = ""; hide(target); return; }
  target.textContent = String(msg);
  show(target);
}

let snackTimer = 0;
function snack(msg, type = "success") {
  if (!el.snackbar) return;
  clearTimeout(snackTimer);
  el.snackbar.textContent = msg;
  el.snackbar.className = `snackbar snack-${type}`;
  show(el.snackbar);
  snackTimer = setTimeout(() => hide(el.snackbar), 2400);
}

function setLoading(btn, textEl, spinnerEl, loading) {
  if (!btn) return;
  btn.disabled = loading;
  if (textEl) textEl.style.visibility = loading ? "hidden" : "visible";
  if (spinnerEl) { if (loading) show(spinnerEl); else hide(spinnerEl); }
}

/* ═══════════════════ Views ═══════════════════ */

function showView(name) {
  hide(el.viewConnect);
  hide(el.viewConnected);
  hide(el.viewUnlock);
  hide(el.viewMain);

  const target = {
    connect: el.viewConnect,
    connected: el.viewConnected,
    unlock: el.viewUnlock,
    main: el.viewMain
  }[name];

  if (target) show(target);

  // Show/hide header actions contextually
  const isMain = name === "main";
  if (el.btnRefresh) el.btnRefresh.style.display = isMain ? "" : "none";
  if (el.btnSettings) el.btnSettings.style.display = (isMain || name === "connect") ? "" : "none";
}

/* ═══════════════════ Tabs ═══════════════════ */

function setTab(which) {
  const isGen = which === "generate";
  el.tabGenerate?.classList.toggle("active", isGen);
  el.tabChoose?.classList.toggle("active", !isGen);
  el.tabGenerate?.setAttribute("aria-selected", String(isGen));
  el.tabChoose?.setAttribute("aria-selected", String(!isGen));
  el.tabGenerate?.setAttribute("tabindex", isGen ? "0" : "-1");
  el.tabChoose?.setAttribute("tabindex", isGen ? "-1" : "0");

  if (isGen) { show(el.panelGenerate); hide(el.panelChoose); }
  else {
    hide(el.panelGenerate);
    show(el.panelChoose);
    el.searchInput?.focus();
    requestAnimationFrame(updateAliasListScrollState);
  }
}

/* ═══════════════════ Background bridge ═══════════════════ */

async function bg(msg) {
  const res = await browser.runtime.sendMessage(msg);
  if (!res || res.ok !== true) {
    throw new Error((res && res.error) ? res.error : "Background error");
  }
  return res;
}

/* ═══════════════════ Domains ═══════════════════ */

async function loadDomains() {
  const TTL = 24 * 60 * 60 * 1000;
  const cached = await getDomainsCache();
  if (cached && Array.isArray(cached.items) && typeof cached.ts === "number" && Date.now() - cached.ts < TTL) {
    DOMAINS = cached.items;
    return;
  }
  const res = await bg({ type: "MAM_GET_DOMAINS" });
  DOMAINS = (Array.isArray(res.items) ? res.items : []).map(d => norm(d)).filter(Boolean);
  await setDomainsCache(DOMAINS);
}

/* ═══════════════════ Combobox ═══════════════════ */

let comboboxWired = false;

function updateGenerateButtonState() {
  if (el.btnGenerateCopy) {
    el.btnGenerateCopy.disabled = isGenerating || !selectedDomain;
  }
  if (!el.domainRequiredHint) return;
  if (!selectedDomain) {
    el.domainRequiredHint.textContent = "Choose a domain to continue.";
    el.domainRequiredHint.className = "field-hint invalid";
    return;
  }
  el.domainRequiredHint.textContent = "";
  el.domainRequiredHint.className = "field-hint";
}

function normalizeCustomHandleFieldValue(raw) {
  return String(raw || "").toLowerCase().trim();
}

function getCustomHandleValidation() {
  const value = normalizeCustomHandleFieldValue(el.customHandle?.value || "");
  if (!value) return { value, empty: true, valid: false, error: "" };
  if (value.length > CUSTOM_HANDLE_MAX_LEN) {
    return { value, empty: false, valid: false, error: `Use ${CUSTOM_HANDLE_MAX_LEN} characters or fewer.` };
  }
  if (!CUSTOM_HANDLE_ALLOWED_RE.test(value)) {
    return { value, empty: false, valid: false, error: "Use only lowercase letters, numbers, dots, underscores, or hyphens." };
  }
  return { value, empty: false, valid: true, error: "" };
}

function updateCustomHandleUI() {
  const validation = getCustomHandleValidation();

  if (el.customHandleHint) {
    if (validation.empty) {
      el.customHandleHint.textContent = "";
      el.customHandleHint.className = "field-hint";
    } else if (!validation.valid) {
      el.customHandleHint.textContent = validation.error;
      el.customHandleHint.className = "field-hint invalid";
    } else {
      el.customHandleHint.textContent = "Looks good.";
      el.customHandleHint.className = "field-hint valid";
    }
  }

  if (el.btnCreateCustom) {
    el.btnCreateCustom.disabled = !selectedDomain || !validation.valid;
  }

  updateHandlePreview();
}

function clearSelectedDomain({ keepInput = true } = {}) {
  selectedDomain = "";
  if (!keepInput && el.domainInput) {
    el.domainInput.value = "";
  }
  updateGenerateButtonState();
  updateCustomHandleUI();
}

function setComboboxHighlight(index) {
  const options = Array.from(el.domainDropdown?.querySelectorAll(".combobox-option") || []);
  if (!options.length) {
    comboboxHighlightIndex = -1;
    el.domainInput?.removeAttribute("aria-activedescendant");
    return;
  }

  const bounded = Math.max(0, Math.min(index, options.length - 1));
  comboboxHighlightIndex = bounded;

  options.forEach((option, i) => {
    const row = option.closest(".combobox-option-row");
    const highlighted = i === bounded;
    row?.classList.toggle("highlighted", highlighted);
    if (highlighted) {
      el.domainInput?.setAttribute("aria-activedescendant", option.id);
      row?.scrollIntoView({ block: "nearest" });
    }
  });
}

function moveComboboxHighlight(delta) {
  if (!comboboxVisibleDomains.length) return;
  const start = comboboxHighlightIndex < 0 ? 0 : comboboxHighlightIndex;
  const next = (start + delta + comboboxVisibleDomains.length) % comboboxVisibleDomains.length;
  setComboboxHighlight(next);
}

function updateChooseTabCount(filteredCount = ALIASES.length) {
  const total = ALIASES_TOTAL || ALIASES.length;
  const totalText = formatCount(total);
  if (el.tabChooseCount) el.tabChooseCount.textContent = `(${totalText})`;
  if (el.tabChoose) el.tabChoose.setAttribute("aria-label", `Choose aliases (${totalText})`);

  if (!el.chooseMeta) return;
  const isFiltered = Number(filteredCount) !== Number(ALIASES.length);
  if (isFiltered) {
    el.chooseMeta.textContent = `Showing ${formatCount(filteredCount)} of ${totalText} aliases`;
    show(el.chooseMeta);
    return;
  }
  el.chooseMeta.textContent = "";
  hide(el.chooseMeta);
}

function updateAliasListScrollState() {
  if (!el.aliasListShell || !el.aliasList) return;
  if (el.aliasList.classList.contains("hidden")) {
    el.aliasListShell.classList.remove("show-top-fade", "show-bottom-fade");
    return;
  }
  const hasOverflow = el.aliasList.scrollHeight > el.aliasList.clientHeight + 1;
  if (!hasOverflow) {
    el.aliasListShell.classList.remove("show-top-fade", "show-bottom-fade");
    return;
  }
  const showTop = hasOverflow && el.aliasList.scrollTop > 4;
  const showBottom = hasOverflow &&
    (el.aliasList.scrollTop + el.aliasList.clientHeight) < (el.aliasList.scrollHeight - 4);

  el.aliasListShell.classList.toggle("show-top-fade", showTop);
  el.aliasListShell.classList.toggle("show-bottom-fade", showBottom);
}

async function renderCombobox(filter = "") {
  const dd = el.domainDropdown;
  if (!dd) return;
  const renderToken = ++comboboxRenderToken;
  dd.textContent = "";
  comboboxVisibleDomains = [];
  comboboxHighlightIndex = -1;

  const favs = await getFavoriteDomains();
  if (renderToken !== comboboxRenderToken) return;
  const q = norm(filter);

  const filtered = DOMAINS.filter(d => !q || d.includes(q));
  if (filtered.length === 0) {
    el.domainInput?.removeAttribute("aria-activedescendant");
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "combobox-empty";
    emptyDiv.textContent = "No matching domains";
    dd.appendChild(emptyDiv);
    return;
  }

  // Separate favorites and rest
  const favList = filtered.filter(d => favs.includes(d));
  const restList = filtered.filter(d => !favs.includes(d));
  let optionIndex = 0;

  const renderGroup = (label, items) => {
    if (items.length === 0) return;
    if (label) {
      const lbl = document.createElement("div");
      lbl.className = "combobox-group-label";
      lbl.textContent = label;
      dd.appendChild(lbl);
    }
    for (const d of items) {
      const isFavorite = favs.includes(d);
      const currentIndex = optionIndex;
      const row = document.createElement("div");
      row.className = "combobox-option-row" + (d === selectedDomain ? " selected" : "");

      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "combobox-option";
      opt.setAttribute("role", "option");
      opt.id = `domain-option-${optionIndex}`;
      opt.dataset.domain = d;
      opt.setAttribute("aria-selected", String(d === selectedDomain));

      const text = document.createElement("span");
      text.className = "combobox-option-text";
      text.textContent = d;
      opt.appendChild(text);

      const star = document.createElement("button");
      star.type = "button";
      star.className = "fav-star-btn" + (isFavorite ? " is-fav" : "");
      star.textContent = isFavorite ? "★" : "☆";
      star.title = isFavorite ? "Remove from favorites" : "Add to favorites";
      star.setAttribute("aria-label", `${isFavorite ? "Remove from favorites" : "Add to favorites"} for ${d}`);
      star.addEventListener("click", async (e) => {
        e.stopPropagation();
        await toggleFavoriteDomain(d);
        await renderCombobox(el.domainInput?.value || "");
      });

      opt.addEventListener("click", () => selectDomain(d));
      row.addEventListener("mouseenter", () => setComboboxHighlight(currentIndex));

      row.appendChild(opt);
      row.appendChild(star);
      dd.appendChild(row);

      comboboxVisibleDomains.push(d);
      optionIndex += 1;
    }
  };

  if (favList.length > 0) renderGroup("Favorites", favList);
  renderGroup(favList.length > 0 ? "All domains" : "", restList);

  const selectedIdx = comboboxVisibleDomains.indexOf(selectedDomain);
  if (selectedIdx >= 0) {
    setComboboxHighlight(selectedIdx);
  } else if (comboboxVisibleDomains.length > 0) {
    setComboboxHighlight(0);
  }

  refineDropdownSpace();
}

function selectDomain(d, { rememberSelection = true } = {}) {
  selectedDomain = d;
  if (el.domainInput) el.domainInput.value = d;
  closeCombobox();
  if (rememberSelection) {
    Promise.all([setLastDomain(d), setHasSelectedDomain(true)]).catch(() => {});
  }
  updateGenerateButtonState();
  updateCustomHandleUI();
}

function openCombobox(filter = "") {
  if (!comboboxOpen) {
    comboboxOpen = true;
    el.domainCombobox?.classList.add("open");
    el.domainInput?.setAttribute("aria-expanded", "true");
    reserveDropdownSpace();
    show(el.domainDropdown);
  }
  void renderCombobox(filter);
}

function closeCombobox() {
  comboboxRenderToken += 1;
  comboboxOpen = false;
  comboboxVisibleDomains = [];
  comboboxHighlightIndex = -1;
  el.domainCombobox?.classList.remove("open");
  el.domainInput?.setAttribute("aria-expanded", "false");
  el.domainInput?.removeAttribute("aria-activedescendant");
  hide(el.domainDropdown);
  releaseDropdownSpace();
}

function reserveDropdownSpace() {
  if (!el.domainCombobox) return;
  const rect = el.domainCombobox.getBoundingClientRect();
  // Reserve: input bottom + 4px gap + 200px max-height + 8px margin
  const needed = rect.bottom + 4 + 200 + 8;
  document.body.style.minHeight = `${needed}px`;
}

function releaseDropdownSpace() {
  document.body.style.minHeight = '';
}

function refineDropdownSpace() {
  if (!comboboxOpen || !el.domainDropdown) return;
  requestAnimationFrame(() => {
    if (!comboboxOpen || !el.domainDropdown) return;
    const rect = el.domainDropdown.getBoundingClientRect();
    document.body.style.minHeight = `${Math.ceil(rect.bottom) + 8}px`;
  });
}

async function initCombobox() {
  const preferred = norm(await getDefaultDomain());
  const rememberedSelection = await hasSelectedDomain();
  const last = rememberedSelection ? norm(await getLastDomain()) : "";

  if (preferred && DOMAINS.includes(preferred)) {
    selectDomain(preferred, { rememberSelection: false });
  } else if (last && DOMAINS.includes(last)) {
    selectDomain(last, { rememberSelection: false });
  } else {
    clearSelectedDomain({ keepInput: false });
  }

  if (comboboxWired) return;
  comboboxWired = true;

  el.domainInput?.addEventListener("focus", () => {
    openCombobox(el.domainInput?.value || "");
  });

  el.domainInput?.addEventListener("input", () => {
    const normalizedInput = normalizeCustomHandleFieldValue(el.domainInput?.value || "");
    if (el.domainInput && el.domainInput.value !== normalizedInput) {
      el.domainInput.value = normalizedInput;
    }
    if (normalizedInput !== selectedDomain) {
      clearSelectedDomain({ keepInput: true });
    }
    openCombobox(normalizedInput);
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!el.domainCombobox?.contains(e.target)) closeCombobox();
  });

  el.domainCombobox?.addEventListener("focusout", () => {
    setTimeout(() => {
      if (!el.domainCombobox?.contains(document.activeElement)) closeCombobox();
    }, 0);
  });

  // Keyboard nav
  el.domainInput?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCombobox();
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      if (!comboboxOpen) openCombobox(el.domainInput?.value || "");
      else moveComboboxHighlight(1);
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowUp") {
      if (!comboboxOpen) openCombobox(el.domainInput?.value || "");
      else moveComboboxHighlight(-1);
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" && comboboxOpen) {
      const chosen = comboboxVisibleDomains[comboboxHighlightIndex];
      if (chosen) selectDomain(chosen);
      e.preventDefault();
      return;
    }
    if (e.key === "Tab" && comboboxOpen) {
      closeCombobox();
    }
  });
}

/* ═══════════════════ Handle preview ═══════════════════ */

function updateHandlePreview() {
  if (!el.handlePreview) return;
  const validation = getCustomHandleValidation();
  const domainPart = selectedDomain || "selected-domain";

  if (validation.empty) {
    el.handlePreview.textContent = `Preview: auto-generated@${domainPart}`;
    el.handlePreview.className = "field-hint";
    return;
  }

  if (!validation.valid) {
    el.handlePreview.textContent = "Preview will appear once the alias name is valid.";
    el.handlePreview.className = "field-hint invalid";
    return;
  }

  el.handlePreview.textContent = `Preview: ${validation.value}@${domainPart}`;
  el.handlePreview.className = "field-hint";
}

/* ═══════════════════ Aliases ═══════════════════ */

function renderAliasList(items) {
  const list = el.aliasList;
  if (!list) return;
  list.textContent = "";

  const arr = Array.isArray(items) ? items : [];

  updateChooseTabCount(arr.length);

  // Empty state
  if (ALIASES.length === 0) {
    hide(list);
    show(el.emptyState);
    updateAliasListScrollState();
    return;
  }
  show(list);
  hide(el.emptyState);

  if (arr.length === 0) {
    const noMatch = document.createElement("div");
    noMatch.style.cssText = "padding:12px;text-align:center;color:var(--text-secondary);font-size:13px";
    noMatch.textContent = "No matches";
    list.appendChild(noMatch);
    updateAliasListScrollState();
    return;
  }

  for (const it of arr) {
    const address = it.address || "";
    const goto = it.goto || "";

    const row = document.createElement("div");
    row.className = "alias-row copyable";

    const info = document.createElement("div");
    info.className = "alias-info";

    const addrEl = document.createElement("div");
    addrEl.className = "alias-address";
    addrEl.textContent = address;
    info.appendChild(addrEl);

    if (goto) {
      const destEl = document.createElement("div");
      destEl.className = "alias-dest";
      destEl.textContent = `\u2192 ${goto}`;
      info.appendChild(destEl);
    }

    const actions = document.createElement("div");
    actions.className = "alias-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "icon-btn btn-copy-alias";
    copyBtn.title = "Copy alias";
    copyBtn.setAttribute("aria-label", "Copy alias");
    copyBtn.appendChild(makeCopyIcon());

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn btn-delete-alias";
    deleteBtn.title = "Delete alias";
    deleteBtn.setAttribute("aria-label", "Delete alias");
    deleteBtn.appendChild(makeTrashIcon());

    actions.appendChild(copyBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(info);
    row.appendChild(actions);

    // Copy
    copyBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      navigator.clipboard.writeText(address).then(() => snack("Copied to clipboard"));
    });

    // Delete
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      confirmDelete(address);
    });

    row.addEventListener("click", (event) => {
      if (event.target.closest(".alias-actions")) return;
      navigator.clipboard.writeText(address).then(() => snack("Copied to clipboard"));
    });

    list.appendChild(row);
  }

  requestAnimationFrame(updateAliasListScrollState);
}

function applySearch() {
  const q = norm(el.searchInput?.value || "");
  if (!q) return renderAliasList(ALIASES);
  const filtered = ALIASES.filter(it => {
    const a = norm(it.address);
    const g = norm(it.goto);
    return a.includes(q) || g.includes(q);
  });
  renderAliasList(filtered);
}

async function refreshAliases() {
  const res = await bg({ type: "MAM_LIST_ALIASES" });
  const items = Array.isArray(res.items) ? res.items : [];
  ALIASES = items;
  ALIASES_TOTAL = typeof res.total === "number" ? res.total : items.length;
  updateChooseTabCount(ALIASES.length);
  applySearch();
}

/* ═══════════════════ Delete modal ═══════════════════ */

function confirmDelete(address) {
  pendingDeleteAddress = address;
  if (el.deleteModalAlias) el.deleteModalAlias.textContent = address;
  show(el.deleteModal);
}

function closeDeleteModal() {
  hide(el.deleteModal);
  pendingDeleteAddress = "";
}

async function executeDelete() {
  const address = pendingDeleteAddress;
  if (!address) return;
  closeDeleteModal();

  try {
    setErr(el.appErr, "");
    await bg({ type: "MAM_DELETE_ALIAS", address });
    snack("Alias deleted");
    await refreshAliases();
  } catch (e) {
    snack(e.message || "Delete failed", "error");
  }
}

/* ═══════════════════ Routing ═══════════════════ */

async function decideRoute() {
  const encPayload = await getApiKeyEncPayload();
  const apiKeyPlain = norm(await getApiKey());

  if (!encPayload && !apiKeyPlain) return "connect";
  if (encPayload) {
    const locked = await isLocked();
    return locked ? "unlock" : "main";
  }
  return isLikelyApiKey(apiKeyPlain) ? "main" : "connect";
}

/* ═══════════════════ Data refresh ═══════════════════ */

async function doRefreshAll() {
  setErr(el.appErr, "");
  show(el.mainLoading);
  try {
    await loadDomains();
    await initCombobox();
    await refreshAliases();
  } finally {
    hide(el.mainLoading);
  }
}

/* ═══════════════════ Bootstrap ═══════════════════ */

async function bootstrap() {
  // Load stored handle style
  handleStyle = await getHandleStyle();
  el.toggleReadable?.classList.toggle("active", handleStyle === "readable");
  el.toggleRandom?.classList.toggle("active", handleStyle === "random");

  /* ──── Header actions ──── */

  el.btnSettings?.addEventListener("click", () => browser.runtime.openOptionsPage());

  el.btnRefresh?.addEventListener("click", async () => {
    try {
      await doRefreshAll();
      snack("Updated");
    } catch (e) {
      snack(e.message || "Refresh failed", "error");
    }
  });

  // Lock button
  const lockConfigured = Boolean(await getApiKeyEncPayload());
  if (lockConfigured) show(el.btnLock); else hide(el.btnLock);

  el.btnLock?.addEventListener("click", () => {
    showView("unlock");
    setErr(el.unlockErr, "");
    if (el.unlockPassword) el.unlockPassword.value = "";
    el.unlockPassword?.focus();
  });

  /* ──── Connect (onboarding) ──── */

  // Credential request form
  function updateRequestKeyButton() {
    const email = (el.credentialEmail?.value || "").trim();
    const days = parseInt(el.credentialDays?.value || "", 10);
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const daysValid = Number.isInteger(days) && days >= 1 && days <= 90;
    if (el.btnRequestKey) el.btnRequestKey.disabled = !emailValid || !daysValid;
  }

  el.credentialEmail?.addEventListener("input", () => {
    const email = (el.credentialEmail.value || "").trim();
    const hint = el.credentialEmailHint;
    if (!email) {
      if (hint) { hint.textContent = ""; hint.className = "field-hint"; }
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (hint) { hint.textContent = "✓ Valid email"; hint.className = "field-hint valid"; }
    } else {
      if (hint) { hint.textContent = "Enter a valid email address"; hint.className = "field-hint invalid"; }
    }
    updateRequestKeyButton();
  });

  el.credentialDays?.addEventListener("input", () => {
    const days = parseInt(el.credentialDays.value || "", 10);
    const hint = el.credentialDaysHint;
    if (!el.credentialDays.value) {
      if (hint) { hint.textContent = ""; hint.className = "field-hint"; }
    } else if (Number.isInteger(days) && days >= 1 && days <= 90) {
      if (hint) { hint.textContent = ""; hint.className = "field-hint"; }
    } else {
      if (hint) { hint.textContent = "Enter a number between 1 and 90"; hint.className = "field-hint invalid"; }
    }
    updateRequestKeyButton();
  });

  el.btnRequestKey?.addEventListener("click", async () => {
    const email = (el.credentialEmail?.value || "").trim();
    const days = parseInt(el.credentialDays?.value || "", 10);
    if (!email || !days) return;

    setErr(el.credentialErr, "");
    hide(el.credentialSuccess);
    setLoading(el.btnRequestKey, el.btnRequestKeyText, el.btnRequestKeySpinner, true);

    try {
      const res = await browser.runtime.sendMessage({
        type: "MAM_CREATE_CREDENTIALS",
        email,
        days
      });
      if (!res || !res.ok) {
        const code = res?.error || "Request failed";
        const friendly = {
          "invalid_params": `Invalid ${res?.data?.field || "parameter"}. Check and try again.`,
          "banned": "This account has been banned.",
          "rate_limited": "Too many requests. Please wait and try again.",
          "temporarily_unavailable": "Service temporarily unavailable. Try again later.",
          "internal_error": "Server error. Try again later."
        }[code] || code;
        throw new Error(friendly);
      }

      if (el.credentialSuccess) {
        const ttl = res.data?.confirmation?.ttl_minutes || 15;
        el.credentialSuccess.textContent = `Confirmation email sent to ${email}. Check your inbox (valid for ${ttl} minutes).`;
        show(el.credentialSuccess);
      }
      if (el.credentialEmail) el.credentialEmail.value = "";
      if (el.credentialEmailHint) { el.credentialEmailHint.textContent = ""; el.credentialEmailHint.className = "field-hint"; }
      updateRequestKeyButton();
    } catch (e) {
      setErr(el.credentialErr, e.message || "Request failed");
    } finally {
      setLoading(el.btnRequestKey, el.btnRequestKeyText, el.btnRequestKeySpinner, false);
    }
  });

  el.credentialEmail?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !el.btnRequestKey?.disabled) el.btnRequestKey.click();
  });

  el.credentialDays?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !el.btnRequestKey?.disabled) el.btnRequestKey.click();
  });

  el.connectKeyInput?.addEventListener("input", () => {
    const v = norm(el.connectKeyInput.value);
    const valid = isLikelyApiKey(v);
    const hint = el.connectKeyHint;

    if (!v) {
      if (hint) { hint.textContent = ""; hint.className = "field-hint"; }
      el.btnConnect && (el.btnConnect.disabled = true);
      return;
    }

    if (hint) {
      hint.textContent = valid ? "✓ Valid format" : `${v.length}/64 characters`;
      hint.className = "field-hint " + (valid ? "valid" : (v.length > 0 ? "invalid" : ""));
    }
    el.btnConnect && (el.btnConnect.disabled = !valid);
  });

  el.btnConnect?.addEventListener("click", async () => {
    const k = norm(el.connectKeyInput.value);
    if (!isLikelyApiKey(k)) return;

    setErr(el.connectErr, "");
    setLoading(el.btnConnect, el.btnConnectText, el.btnConnectSpinner, true);

    try {
      // Verify key before saving
      const res = await browser.runtime.sendMessage({ type: "MAM_VERIFY_KEY", apiKey: k });
      if (!res || !res.ok) {
        throw new Error(res?.error === "http_401" ? "Invalid API key. Check and try again." : (res?.error || "Verification failed"));
      }

      await setApiKey(k);
      if (el.connectKeyInput) el.connectKeyInput.value = "";
      showView("connected");
    } catch (e) {
      setErr(el.connectErr, e.message || "Connection failed");
    } finally {
      setLoading(el.btnConnect, el.btnConnectText, el.btnConnectSpinner, false);
    }
  });

  // Enter key in connect input
  el.connectKeyInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !el.btnConnect?.disabled) el.btnConnect.click();
  });

  /* ──── Connected success ──── */

  el.btnStartUsing?.addEventListener("click", async () => {
    showView("main");
    setTab("generate");
    try { await doRefreshAll(); } catch (e) { setErr(el.appErr, e.message); }
  });

  el.btnSetupLock?.addEventListener("click", () => browser.runtime.openOptionsPage());

  /* ──── Unlock ──── */

  el.btnUnlock?.addEventListener("click", async () => {
    try {
      setErr(el.unlockErr, "");
      const pass = el.unlockPassword?.value || "";
      if (pass.length < 6) throw new Error("Password too short.");

      const payload = await getApiKeyEncPayload();
      if (!payload) throw new Error("No encrypted key found.");

      const apiKey = norm(await decryptString(payload, pass));
      if (!isLikelyApiKey(apiKey)) throw new Error("Invalid API key after decryption.");

      await bg({ type: "MAM_SET_SESSION_KEY", apiKey });
      if (el.unlockPassword) el.unlockPassword.value = "";

      showView("main");
      setTab("generate");
      await doRefreshAll();
      snack("Unlocked");
    } catch (e) {
      setErr(el.unlockErr, e.message || "Unlock failed");
    }
  });

  el.unlockPassword?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") el.btnUnlock?.click();
  });

  /* ──── Tabs ──── */

  el.tabGenerate?.addEventListener("click", () => setTab("generate"));
  el.tabChoose?.addEventListener("click", () => setTab("choose"));
  const handleTabsKeyboard = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let target = event.currentTarget?.id === "tabGenerate" ? "generate" : "choose";
    if (event.key === "ArrowRight") target = target === "generate" ? "choose" : "generate";
    if (event.key === "ArrowLeft") target = target === "generate" ? "choose" : "generate";
    if (event.key === "Home") target = "generate";
    if (event.key === "End") target = "choose";
    setTab(target);
    if (target === "generate") el.tabGenerate?.focus();
    else el.tabChoose?.focus();
  };
  el.tabGenerate?.addEventListener("keydown", handleTabsKeyboard);
  el.tabChoose?.addEventListener("keydown", handleTabsKeyboard);

  /* ──── Generate & Copy ──── */

  el.btnGenerateCopy?.addEventListener("click", async () => {
    if (!selectedDomain) { snack("Choose a domain first.", "error"); return; }

    setErr(el.appErr, "");
    isGenerating = true;
    updateGenerateButtonState();
    setLoading(el.btnGenerateCopy, el.btnGenText, el.btnGenSpinner, true);

    try {
      const res = await bg({
        type: "MAM_GENERATE_WITH_DOMAIN",
        domain: selectedDomain,
        useReadable: handleStyle === "readable"
      });

      if (res.email) {
        await navigator.clipboard.writeText(res.email);
        snack(`Copied: ${res.email}`);
      } else {
        snack("Alias created");
      }

      await refreshAliases();
    } catch (e) {
      snack(e.message || "Failed to generate alias", "error");
    } finally {
      isGenerating = false;
      setLoading(el.btnGenerateCopy, el.btnGenText, el.btnGenSpinner, false);
      updateGenerateButtonState();
    }
  });

  /* ──── More options ──── */

  el.btnMoreOptions?.addEventListener("click", () => {
    const expanded = el.btnMoreOptions.getAttribute("aria-expanded") === "true";
    el.btnMoreOptions.setAttribute("aria-expanded", String(!expanded));
    if (expanded) hide(el.moreOptions); else show(el.moreOptions);
  });

  // Handle style toggle
  el.toggleReadable?.addEventListener("click", () => {
    handleStyle = "readable";
    el.toggleReadable.classList.add("active");
    el.toggleReadable.setAttribute("aria-checked", "true");
    el.toggleRandom?.classList.remove("active");
    el.toggleRandom?.setAttribute("aria-checked", "false");
    setHandleStyle("readable");
  });

  el.toggleRandom?.addEventListener("click", () => {
    handleStyle = "random";
    el.toggleRandom.classList.add("active");
    el.toggleRandom.setAttribute("aria-checked", "true");
    el.toggleReadable?.classList.remove("active");
    el.toggleReadable?.setAttribute("aria-checked", "false");
    setHandleStyle("random");
  });

  // Custom handle
  el.customHandle?.addEventListener("input", () => {
    const normalized = normalizeCustomHandleFieldValue(el.customHandle?.value || "");
    if (el.customHandle && el.customHandle.value !== normalized) {
      el.customHandle.value = normalized;
    }
    updateCustomHandleUI();
  });

  el.btnCreateCustom?.addEventListener("click", async () => {
    const validation = getCustomHandleValidation();
    const handle = validation.value;
    if (!validation.valid) {
      snack(validation.empty ? "Enter a custom alias name first" : validation.error, "error");
      return;
    }
    if (!selectedDomain) { snack("Choose a domain first.", "error"); return; }

    setErr(el.appErr, "");
    try {
      const res = await bg({
        type: "MAM_GENERATE_WITH_DOMAIN",
        domain: selectedDomain,
        customHandle: handle
      });

      if (res.email) {
        await navigator.clipboard.writeText(res.email);
        snack(`Created & copied: ${res.email}`);
      }
      if (el.customHandle) el.customHandle.value = "";
      updateCustomHandleUI();
      await refreshAliases();
    } catch (e) {
      snack(e.message || "Failed to create alias", "error");
    }
  });

  /* ──── Choose tab ──── */

  el.searchInput?.addEventListener("input", applySearch);
  if (!aliasListWired) {
    aliasListWired = true;
    el.aliasList?.addEventListener("scroll", updateAliasListScrollState, { passive: true });
    window.addEventListener("resize", updateAliasListScrollState);
  }

  el.btnEmptyGenerate?.addEventListener("click", () => setTab("generate"));

  /* ──── Delete modal ──── */

  el.btnDeleteCancel?.addEventListener("click", closeDeleteModal);
  el.btnDeleteConfirm?.addEventListener("click", executeDelete);

  // Close modal on overlay click
  el.deleteModal?.addEventListener("click", (e) => {
    if (e.target === el.deleteModal) closeDeleteModal();
  });

  // Close modal on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.deleteModal?.classList.contains("hidden")) closeDeleteModal();
  });

  updateGenerateButtonState();
  updateCustomHandleUI();

  /* ──── Initial route ──── */

  const route = await decideRoute();
  showView(route);

  if (route === "main") {
    setTab("generate");
    try { await doRefreshAll(); } catch (e) { setErr(el.appErr, e.message || "Failed to load."); }
  }

  if (route === "connect") {
    el.connectKeyInput?.focus();
  }

  if (route === "unlock") {
    el.unlockPassword?.focus();
  }
}

bootstrap();
