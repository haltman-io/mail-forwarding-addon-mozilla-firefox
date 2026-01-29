# Whiteboard (Reviewer Notes)

## How to Test
- Load the add-on temporarily in Firefox: `about:debugging#/runtime/this-firefox`.
- Open any page with `input[type="email"]` (for example a simple test form).
- Click the in-page button/icon next to the email input.
- Test **Generate** (creates a random alias and inserts it).
- Test **Choose** (lists aliases and inserts the selected one).
- Verify the context menu item “Generate random alias” creates and copies an alias.

## Popup and Options Testing
- Open the toolbar popup, paste a valid API key, and click **Save**.
- In **Create**: select a domain, enter a handle, and **Create**.
- In **List**: search, **Copy** (📑), and **Delete** (🗑️) an alias.
- Click **Generate random** in the popup and verify the alias is created (check the List tab).
- Open **Options**: change UI mode (buttons/icon) and refresh a page to see the change.
- In **Options**, set a **Default domain** (uses `/domains`).
- Security lock flow:
  - Enable lock with a password (PBKDF2 + AES‑GCM).
  - Click **Lock now**, then unlock via popup to verify session‑only access.

## Request API Token
```sh
curl -i -k -X POST 'https://mail.haltman.io/api/credentials/create?email={YOUR-EMAIL-ADDRESS}&days={DAYS}'
```
- `YOUR-EMAIL-ADDRESS`: example `user@example.com`
- `DAYS`: number of days the API key will be valid (max 90, numeric only)
- Check your mailbox for the anti-abuse token.

## Activate API Token
```sh
curl -i -k 'https://mail.haltman.io/api/credentials/confirm?token={ANTI-ABUSE-UNIQUE-TOKEN}'
```
The response contains your API token:
```
Your API Token: <api-token>
```

## Network Endpoints Used
- `GET https://mail.haltman.io/domains`
- `GET https://mail.haltman.io/api/alias/list`
- `POST https://mail.haltman.io/api/alias/create`
- `POST https://mail.haltman.io/api/alias/delete`

## Permission Notes (Why They Are Needed)
- `storage`: saves API key, settings, domain cache, and encrypted payload.
- `contextMenus`: adds “Email Alias Manager → Generate random alias”.
- `notifications`: shows success/error messages after create/copy.
- `clipboardWrite`: copies generated aliases to the clipboard.
- `tabs` / `activeTab`: clipboard fallback via `tabs.executeScript`.
- `<all_urls>` content script: injects UI next to email inputs only.
- `https://mail.haltman.io/*`: API requests to the service.

## Data Handling
- API key is stored in `storage.local`.
- Optional lock encrypts the API key with PBKDF2‑SHA256 + AES‑256‑GCM.
- When locked, the decrypted key lives only in background session memory.
- The add‑on does not read page content or send page URLs to the backend.

## Additional Notes
- A valid API key is required; without it the add-on shows onboarding only.
- The add-on communicates only with `https://mail.haltman.io` for alias operations.
