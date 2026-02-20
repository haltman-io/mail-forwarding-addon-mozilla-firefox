# Privacy Policy - Mail Alias Manager (Free)

Last updated: February 20, 2026

This Firefox add-on is designed with a privacy-first approach. It processes only the data required to create and manage email aliases and does not include analytics, telemetry, or behavioral profiling.

## Data Stored Locally

The add-on stores data in `browser.storage.local` on your device.

- API credentials
  - `apiKey` (plaintext only when lock is disabled)
  - `apiKeyEncPayload` and `locked` when password lock is enabled
  - Encryption uses PBKDF2 for key derivation and AES-GCM for encryption
  - The lock password is never stored, transmitted, or logged
- Alias/domain preferences
  - `domainsCache`, `defaultDomain`, `lastDomain`, `hasSelectedDomain`, `favoriteDomains`
- UI preferences
  - `uiMode`, `handleStyle`, `skipDeleteConfirm`
- Overlay controls
  - `overlayEnabled`, `overlayMode`, `overlaySites`
  - `overlaySites` contains user-defined site rules (for example `host:example.com`, `file://...`, or special browser-page keys)

No locally stored data is sold or shared with third parties by the extension.

## Local Page Processing

To show or hide the helper UI on a page, the add-on may read the current page URL/host locally in the browser (for overlay allowlist/denylist checks). This check stays local and is not transmitted to remote servers.

## Network Requests

The add-on communicates only with:

- `https://mail.haltman.io`

Current operations used by the extension:

- `GET /domains`
- `GET /api/alias/list` (including key verification with `limit=1` and `offset=0`)
- `POST /api/alias/create`
- `POST /api/alias/delete`
- `POST /api/credentials/create`

Depending on user action, transmitted fields can include:

- API key in `X-API-Key` for authenticated alias operations
- Alias fields (`alias_handle`, `alias_domain`, `alias`)
- Credential request fields (`email`, `days`) when requesting a new API key

## What Is Not Transmitted

The add-on does not transmit:

- Browsing history
- Page content
- Existing values of email input fields
- Analytics or telemetry payloads
- Data unrelated to alias operations

## Clipboard and User Actions

Clipboard writes occur only after explicit user actions (such as popup actions or context-menu actions) to copy aliases, with visible feedback when possible.

## User Data and Tracking

- No analytics SDKs
- No telemetry
- No behavioral profiling

## Abuse Prevention

Haltman.io does not tolerate abuse of its services.

Attempts to misuse or exploit the infrastructure may result in:

- Neutralization of abusive actions
- Suspension or revocation of API access
- Additional technical or administrative countermeasures as required

The service may be monitored for abuse prevention and infrastructure protection.

## Transparency and Source Code

This project is open source and auditable. Source code and technical documentation are available via links in the add-on listing or support channels.

## Contact

For questions, concerns, or reports:

- General: `root@haltman.io` AND `members@proton.thc.org`
- Privacy: `root@haltman.io` AND `members@proton.thc.org`
- Abuse reports: `root@haltman.io` AND `members@proton.thc.org`

By using this add-on, you agree to this privacy policy.
