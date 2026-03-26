/* global browser */
"use strict";

let SESSION_API_KEY = "";

function setSessionKey(k) { SESSION_API_KEY = (k || "").trim().toLowerCase(); }
function clearSessionKey() { SESSION_API_KEY = ""; }

async function isLockedStorage() {
    const res = await browser.storage.local.get("locked");
    return Boolean(res.locked);
}

async function getApiKeyForOps() {
    const locked = await isLockedStorage();
    if (locked) {
        if (!SESSION_API_KEY) throw new Error("Locked. Open the extension and unlock first.");
        return SESSION_API_KEY;
    }

    // legacy mode (no password): read from storage
    const res = await browser.storage.local.get("apiKey");
    const k = (res.apiKey || "").trim().toLowerCase();
    if (!k) throw new Error("API-Key not set.");
    return k;
}

const BASE_URL = "https://mail.haltman.io";
const DICTIONARY_URL = browser.runtime.getURL("data/dictionary.json");
const KEY_API_KEY = "apiKey";

const MENU_ID = "generate-random-alias";
const REQUEST_TIMEOUT_MS = 30000;

// ---------- utils ----------
function secureRandomIndex(length) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % length;
}

function pickRandom(arr) {
    return arr[secureRandomIndex(arr.length)];
}

function normalizeWord(s) {
    // your API does NOT support "-", so keep only [a-z0-9]
    return String(s || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ""); // <-- also removes "-"
}

function isValidCustomHandle(handle) {
    return /^[a-z0-9._-]{1,64}$/.test(String(handle || ""));
}

async function getApiKey() {
    const res = await browser.storage.local.get(KEY_API_KEY);
    return (res[KEY_API_KEY] || "").trim().toLowerCase();
}

async function fetchJson(url, init) {
    const res = await fetch(url, init);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { }

    if (!res.ok) {
        const code = (data && data.error) || `http_${res.status}`;
        const err = new Error(code);
        err.status = res.status;
        err.code = code;
        err.data = data;
        throw err;
    }
    return data;
}

async function getDictionary() {
    const data = await fetchJson(DICTIONARY_URL);
    if (!Array.isArray(data)) throw new Error("dictionary.json must be an array of strings.");

    const words = data.map(normalizeWord).filter(Boolean);
    if (words.length < 2) throw new Error("dictionary.json needs at least 2 valid words.");

    return words;
}

async function getDomains() {
    const data = await fetchJson(`${BASE_URL}/api/domains`, { method: "GET", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!Array.isArray(data)) throw new Error("Invalid /domains response.");
    return data.map(d => String(d).trim().toLowerCase()).filter(Boolean);
}

async function copyToClipboardBackground(text) {
    // In MV2, the background runs in a context with navigator.
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}


async function createAlias(apiKey, aliasHandle, aliasDomain) {
    const res = await fetch(`${BASE_URL}/api/alias/create`, {
        method: "POST",
        headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ alias_handle: aliasHandle, alias_domain: aliasDomain }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { }

    if (!res.ok) {
        const code = (data && data.error) || `http_${res.status}`;
        const err = new Error(code);
        err.status = res.status;
        err.code = code;
        err.data = data;
        throw err;
    }

    return data;
}

async function deleteAlias(apiKey, aliasEmail) {
  const res = await fetch(`${BASE_URL}/api/alias/delete`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ alias: aliasEmail }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!res.ok) {
    const code = (data && data.error) || `http_${res.status}`;
    const err = new Error(code);
    err.status = res.status;
    err.code = code;
    err.data = data;
    throw err;
  }

  return data;
}


async function copyToClipboardViaTab(tabId, text) {
    // MV2: use tabs.executeScript with a safe static script + message passing
    // instead of injecting user data into a code string.
    const listener = (message) => {
        if (message?.type === "MAM_CLIPBOARD_REQUEST") return Promise.resolve({ text });
    };
    browser.runtime.onMessage.addListener(listener);
    try {
        await browser.tabs.executeScript(tabId, {
            code: `(async()=>{try{const r=await browser.runtime.sendMessage({type:"MAM_CLIPBOARD_REQUEST"});if(r&&r.text)await navigator.clipboard.writeText(r.text);}catch{}})();`
        });
    } finally {
        browser.runtime.onMessage.removeListener(listener);
    }
}

async function notify(title, message) {
    try {
        await browser.notifications.create({
            type: "basic",
            iconUrl: browser.runtime.getURL("icons/icon-96.png"),
            title,
            message
        });
    } catch { }
}

function ensureMenu() {
    try { browser.contextMenus.removeAll(); } catch { }

    // Parent (folder)
    const parentId = browser.contextMenus.create({
        id: "mam-root",
        title: "Email Alias Manager",
        contexts: ["all"]
    });

    // Child: Generate random alias
    browser.contextMenus.create({
        id: MENU_ID, // "generate-random-alias"
        parentId,
        title: "Generate random alias",
        contexts: ["all"]
    });

    // (optional) extra child in the future:
    // browser.contextMenus.create({
    //   id: "mam-open",
    //   parentId,
    //   title: "Open extension",
    //   contexts: ["all"]
    // });
}

const DEFAULT_PAGE_LIMIT = 50;

async function listAliasesBg(apiKey) {
    const allItems = [];
    let offset = 0;
    let total = 0;

    for (;;) {
        const url = new URL(`${BASE_URL}/api/alias/list`);
        url.searchParams.set("limit", String(DEFAULT_PAGE_LIMIT));
        url.searchParams.set("offset", String(offset));

        const res = await fetch(url.href, {
            method: "GET",
            headers: { "X-API-Key": apiKey },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });

        const text = await res.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch { }

        if (!res.ok) {
            const code = (data && data.error) || `http_${res.status}`;
            const err = new Error(code);
            err.status = res.status;
            err.code = code;
            err.data = data;
            throw err;
        }

        const items = Array.isArray(data?.items) ? data.items : [];
        allItems.push(...items);
        total = data?.pagination?.total ?? allItems.length;

        if (items.length < DEFAULT_PAGE_LIMIT || allItems.length >= total) break;
        offset += DEFAULT_PAGE_LIMIT;
    }

    return { items: allItems, total };
}

async function generateRandomAliasEmail(apiKey) {
    const [words, domains] = await Promise.all([getDictionary(), getDomains()]);
    if (!domains.length) throw new Error("No domains available from /domains.");

    const w1 = pickRandom(words);
    let w2 = pickRandom(words);
    if (words.length > 1) {
        let guard = 0;
        while (w2 === w1 && guard++ < 10) w2 = pickRandom(words);
    }

    const handle = `${w1}.${w2}`; // ONLY "."
    const domain = pickRandom(domains);

    const created = await createAlias(apiKey, handle, domain);
    return (created && (created.alias || created.address)) || `${handle}@${domain}`;
}

browser.runtime.onMessage.addListener((msg) => {
    return (async () => {
        if (!msg || !msg.type) {
            return { ok: false, error: "Invalid message" };
        }

        // ---------- session control ----------
        if (msg.type === "MAM_SET_SESSION_KEY") {
            setSessionKey(msg.apiKey);
            return { ok: true };
        }

        if (msg.type === "MAM_CLEAR_SESSION_KEY") {
            clearSessionKey();
            return { ok: true };
        }

        // ---------- create credentials (no session required) ----------
        if (msg.type === "MAM_CREATE_CREDENTIALS") {
            const email = String(msg.email || "").trim();
            const days = Number(msg.days) || 30;
            if (!email) return { ok: false, error: "invalid_params", data: { field: "email" } };
            if (!Number.isInteger(days) || days < 1 || days > 90) return { ok: false, error: "invalid_params", data: { field: "days" } };
            try {
                const res = await fetch(`${BASE_URL}/api/credentials/create`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, days }),
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
                });
                const text = await res.text();
                let data = null;
                try { data = text ? JSON.parse(text) : null; } catch {}
                if (!res.ok) {
                    const code = (data && data.error) || `http_${res.status}`;
                    return { ok: false, error: code, data };
                }
                return { ok: true, data };
            } catch (e) {
                return { ok: false, error: e.message || "Network error" };
            }
        }

        // ---------- verify key (no session required) ----------
        if (msg.type === "MAM_VERIFY_KEY") {
            const key = String(msg.apiKey || "").trim().toLowerCase();
            if (!key) return { ok: false, error: "No key provided." };
            try {
                const url = new URL(`${BASE_URL}/api/alias/list`);
                url.searchParams.set("limit", "1");
                url.searchParams.set("offset", "0");
                const res = await fetch(url.href, {
                    method: "GET",
                    headers: { "X-API-Key": key },
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
                });
                if (res.ok) {
                    return { ok: true, verified: true };
                }
                const text = await res.text();
                let data = null;
                try { data = text ? JSON.parse(text) : null; } catch {}
                return { ok: false, error: (data && data.error) || `http_${res.status}` };
            } catch (e) {
                return { ok: false, error: e.message || "Network error" };
            }
        }

        // ---------- operations (need key) ----------
        const apiKey = await getApiKeyForOps();

        if (msg.type === "MAM_GENERATE_RANDOM_ALIAS") {
            const email = await generateRandomAliasEmail(apiKey);
            return { ok: true, email };
        }

        if (msg.type === "MAM_GENERATE_WITH_DOMAIN") {
            const domain = String(msg.domain || "").trim().toLowerCase();
            const useReadable = msg.useReadable !== false;
            const customHandle = String(msg.customHandle || "").trim().toLowerCase();

            let handle;
            if (customHandle) {
                if (!isValidCustomHandle(customHandle)) {
                    throw new Error("Custom alias name can only use a-z, 0-9, dots, underscores, or hyphens (max 64).");
                }
                handle = customHandle;
            } else if (useReadable) {
                const words = await getDictionary();
                const w1 = pickRandom(words);
                let w2 = pickRandom(words);
                if (words.length > 1) {
                    let guard = 0;
                    while (w2 === w1 && guard++ < 10) w2 = pickRandom(words);
                }
                handle = `${w1}.${w2}`;
            } else {
                const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
                handle = "";
                for (let i = 0; i < 12; i++) handle += chars[secureRandomIndex(chars.length)];
            }

            let actualDomain = domain;
            if (!actualDomain) {
                const domains = await getDomains();
                if (!domains.length) throw new Error("No domains available.");
                actualDomain = pickRandom(domains);
            }

            const created = await createAlias(apiKey, handle, actualDomain);
            const email = (created && (created.alias || created.address)) || `${handle}@${actualDomain}`;
            return { ok: true, email };
        }

        if (msg.type === "MAM_LIST_ALIASES") {
            const result = await listAliasesBg(apiKey);
            return { ok: true, items: result.items, total: result.total };
        }

        if (msg.type === "MAM_GET_DOMAINS") {
            const items = await getDomains(); // already exists in the background
            return { ok: true, items };
        }

        if (msg.type === "MAM_CREATE_ALIAS") {
            const apiKey = await getApiKeyForOps();
            const handle = String(msg.handle || "").trim().toLowerCase();
            const domain = String(msg.domain || "").trim().toLowerCase();
            await createAlias(apiKey, handle, domain); // already exists in the background
            return { ok: true };
        }

        if (msg.type === "MAM_DELETE_ALIAS") {
            const apiKey = await getApiKeyForOps();
            const address = String(msg.address || "").trim().toLowerCase();
            await deleteAlias(apiKey, address); // must exist (or implement like createAlias)
            return { ok: true };
        }


        return { ok: false, error: "Unknown message type" };
    })().catch((e) => ({
        ok: false,
        error: e.message || String(e)
    }));
});




browser.runtime.onInstalled.addListener(ensureMenu);
browser.runtime.onStartup.addListener(ensureMenu);

browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== MENU_ID) return;

    try {
        const apiKey = await getApiKeyForOps();
        if (!apiKey) {
            await notify("Mail Alias Manager", "API-Key not set. Open the extension and save your key first.");
            return;
        }

        const [words, domains] = await Promise.all([getDictionary(), getDomains()]);
        if (!domains.length) throw new Error("No domains available from /domains.");

        // word1.word2 (only ".")
        const w1 = pickRandom(words);
        let w2 = pickRandom(words);
        if (words.length > 1) {
            let guard = 0;
            while (w2 === w1 && guard++ < 10) w2 = pickRandom(words);
        }

        const handle = `${w1}.${w2}`;
        const domain = pickRandom(domains);

        const created = await createAlias(apiKey, handle, domain);
        const aliasEmail =
            (created && (created.alias || created.address)) ||
            `${handle}@${domain}`;

        // 1) try copying directly in the background (more reliable in Firefox)
        let copied = await copyToClipboardBackground(aliasEmail);

        // 2) fallback: try copying via active tab
        if (!copied && tab && tab.id != null) {
            try {
                await copyToClipboardViaTab(tab.id, aliasEmail);
                copied = true;
            } catch { }
        }

        if (copied) {
            await notify("Alias created", `${aliasEmail}\nCopied to clipboard.`);
        } else {
            await notify("Alias created", `${aliasEmail}\nCould not copy automatically (Firefox clipboard policy).`);
        }

    } catch (e) {
        await notify("Mail Alias Manager", `Failed: ${e.message || String(e)}`);
    }
});
