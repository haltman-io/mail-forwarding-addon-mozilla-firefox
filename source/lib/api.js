// lib/api.js
"use strict";

/** @const {string} Base URL for all API requests */
const BASE_URL = "https://mail.haltman.io";

/** @const {number} Default page size for paginated endpoints */
const DEFAULT_PAGE_LIMIT = 50;

/**
 * Validates whether a string looks like a valid 64-char hex API key.
 * @param {string} k
 * @returns {boolean}
 */
export function isLikelyApiKey(k) {
  return typeof k === "string" && /^[a-z0-9]{64}$/.test(k.trim());
}

/**
 * Builds standard request headers.
 * @param {string|null} apiKey - The 64-char hex API key (null for unauthenticated requests)
 * @param {boolean} [json=false] - Whether to include Content-Type: application/json
 * @returns {Headers}
 */
function buildHeaders(apiKey, json = false) {
  const h = new Headers();
  if (apiKey) h.set("X-API-Key", apiKey);
  if (json) h.set("Content-Type", "application/json");
  return h;
}

/**
 * Parses a fetch Response as JSON. Throws a structured error on non-2xx status.
 *
 * Error objects include:
 * - `.status`  — HTTP status code
 * - `.code`    — API error code string (e.g. "invalid_params", "rate_limited")
 * - `.data`    — Full parsed error body
 *
 * @param {Response} res
 * @returns {Promise<Object|null>}
 */
async function parseResponse(res) {
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }

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

// ━━━ Public endpoints (no auth) ━━━

/**
 * Fetches available domains from the public /domains endpoint.
 * @returns {Promise<string[]>}
 */
export async function getDomains() {
  const res = await fetch(`${BASE_URL}/domains`, { method: "GET" });
  const data = await parseResponse(res);
  if (!Array.isArray(data)) return [];
  return data.map(s => String(s).trim().toLowerCase()).filter(Boolean);
}

// ━━━ Credentials ━━━

/**
 * Creates API credentials (triggers a confirmation email).
 * @param {string} email - The destination email address
 * @param {number} days - Credential validity in days (1–90)
 * @returns {Promise<{ ok: boolean, action: string, email: string, days: number, confirmation: { sent: boolean, ttl_minutes: number } }>}
 */
export async function createCredentials(email, days) {
  const res = await fetch(`${BASE_URL}/api/credentials/create`, {
    method: "POST",
    headers: buildHeaders(null, true),
    body: JSON.stringify({ email, days })
  });
  return parseResponse(res);
}

// ━━━ Aliases ━━━

/**
 * @typedef {Object} AliasItem
 * @property {number} id
 * @property {string} address
 * @property {string} goto
 * @property {number} active
 * @property {number} domain_id
 * @property {string} created
 * @property {string} modified
 */

/**
 * @typedef {Object} AliasPagination
 * @property {number} total
 * @property {number} limit
 * @property {number} offset
 */

/**
 * @typedef {Object} AliasListResponse
 * @property {AliasItem[]} items
 * @property {AliasPagination} pagination
 */

/**
 * Fetches a single page of aliases.
 * @param {string} apiKey
 * @param {Object} [opts]
 * @param {number} [opts.limit=50] - Items per page
 * @param {number} [opts.offset=0] - Starting offset
 * @returns {Promise<AliasListResponse>}
 */
export async function listAliases(apiKey, { limit = DEFAULT_PAGE_LIMIT, offset = 0 } = {}) {
  const url = new URL(`${BASE_URL}/api/alias/list`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const res = await fetch(url.href, {
    method: "GET",
    headers: buildHeaders(apiKey)
  });

  const data = await parseResponse(res);
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    pagination: data?.pagination ?? { total: 0, limit, offset }
  };
}

/**
 * Fetches ALL aliases by iterating through every page.
 * @param {string} apiKey
 * @param {number} [pageSize=50]
 * @returns {Promise<{ items: AliasItem[], total: number }>}
 */
export async function listAllAliases(apiKey, pageSize = DEFAULT_PAGE_LIMIT) {
  const allItems = [];
  let offset = 0;
  let total = 0;

  for (;;) {
    const page = await listAliases(apiKey, { limit: pageSize, offset });
    allItems.push(...page.items);
    total = page.pagination.total ?? allItems.length;

    if (page.items.length < pageSize || allItems.length >= total) break;
    offset += pageSize;
  }

  return { items: allItems, total };
}

/**
 * Fetches alias statistics.
 * @param {string} apiKey
 * @returns {Promise<{ totals: number, active: number, created_last_7d: number, modified_last_24h: number, by_domain: Array<{ domain: string, total: number, active: number }> }>}
 */
export async function getAliasStats(apiKey) {
  const res = await fetch(`${BASE_URL}/api/alias/stats`, {
    method: "GET",
    headers: buildHeaders(apiKey)
  });
  return parseResponse(res);
}

/**
 * Creates a new alias.
 * @param {string} apiKey
 * @param {string} aliasHandle - The local part of the alias
 * @param {string} aliasDomain - The domain for the alias
 * @returns {Promise<{ ok: boolean, created: boolean, address: string, goto: string }>}
 */
export async function createAlias(apiKey, aliasHandle, aliasDomain) {
  const res = await fetch(`${BASE_URL}/api/alias/create`, {
    method: "POST",
    headers: buildHeaders(apiKey, true),
    body: JSON.stringify({ alias_handle: aliasHandle, alias_domain: aliasDomain })
  });
  return parseResponse(res);
}

/**
 * Deletes an alias.
 * @param {string} apiKey
 * @param {string} alias - Full email address of the alias to delete
 * @returns {Promise<{ ok: boolean, deleted: boolean, alias: string }>}
 */
export async function deleteAlias(apiKey, alias) {
  const res = await fetch(`${BASE_URL}/api/alias/delete`, {
    method: "POST",
    headers: buildHeaders(apiKey, true),
    body: JSON.stringify({ alias })
  });
  return parseResponse(res);
}

// ━━━ Activity ━━━

/**
 * @typedef {Object} ActivityItem
 * @property {string} type
 * @property {string} occurred_at
 * @property {string} route
 * @property {string|null} intent
 * @property {string|null} alias
 */

/**
 * Fetches a single page of activity events.
 * @param {string} apiKey
 * @param {Object} [opts]
 * @param {number} [opts.limit=50]
 * @param {number} [opts.offset=0]
 * @returns {Promise<{ items: ActivityItem[], pagination: { limit: number, offset: number } }>}
 */
export async function getActivity(apiKey, { limit = DEFAULT_PAGE_LIMIT, offset = 0 } = {}) {
  const url = new URL(`${BASE_URL}/api/activity`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const res = await fetch(url.href, {
    method: "GET",
    headers: buildHeaders(apiKey)
  });

  const data = await parseResponse(res);
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    pagination: data?.pagination ?? { limit, offset }
  };
}

/**
 * Fetches ALL activity events by iterating through every page.
 * @param {string} apiKey
 * @param {number} [pageSize=50]
 * @returns {Promise<{ items: ActivityItem[] }>}
 */
export async function listAllActivity(apiKey, pageSize = DEFAULT_PAGE_LIMIT) {
  const allItems = [];
  let offset = 0;

  for (;;) {
    const page = await getActivity(apiKey, { limit: pageSize, offset });
    allItems.push(...page.items);

    if (page.items.length < pageSize) break;
    offset += pageSize;
  }

  return { items: allItems };
}
