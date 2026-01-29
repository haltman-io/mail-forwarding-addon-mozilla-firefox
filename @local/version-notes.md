# Email Alias Manager (Free)

## Description
Manage email aliases for Haltman.io Mail Forwarding directly in the browser. Create, list, and delete aliases using your API key, with quick in‑page actions on email fields and a right‑click context menu to generate a random alias and copy it to the clipboard.

## Features
- Manage aliases via the Haltman.io Mail Forwarding API (list, create, delete).
- In‑page UI next to email inputs for fast alias insertion:
  - Generate: creates a random alias (word1.word2) and inserts it into the input.
  - Choose: loads your existing aliases and inserts the selected alias into the input.
- Context menu item (“Generate random alias”) to create an alias and copy it to the clipboard with a notification.
- Works only with a valid API key (onboarding shown otherwise).
- Communicates only with `https://mail.haltman.io` (alias operations).
- Does not read existing email field values before writing.
- Does not send the current website URL or page content to the backend.
- Optional local lock: API key stored encrypted (PBKDF2 + AES‑GCM); password is never stored.

## Change Log (this version)
- Fixed AMO linter warnings about unsafe `innerHTML` in the content script.
- Replaced dynamic `innerHTML` with safe DOM creation (`createElement` + `textContent`) in:
  - Alias list rendering.
  - Icon button image creation.
- No functional changes expected; this is a security/DOM-safety improvement.
