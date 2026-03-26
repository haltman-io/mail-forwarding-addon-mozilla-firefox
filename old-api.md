`POST /api/credentials/create`  
Como chamar:
```bash
curl -X POST "https://mail.haltman.io/api/credentials/create" \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@exemplo.com","days":30}'
```
Sucesso (200):
```json
{
  "ok": true,
  "action": "api_credentials_create",
  "email": "dev@exemplo.com",
  "days": 30,
  "confirmation": {
    "sent": true,
    "ttl_minutes": 15
  }
}
```
Possíveis erros:
- `400` `{ "error": "invalid_params", "field": "email" }`
- `400` `{ "error": "invalid_params", "field": "days", "hint": "integer 1..90" }`
- `403` `{ "error": "banned", "ban": { ... } }`
- `429` `{ "error": "rate_limited", "where": "credentials_create", "reason": "too_many_requests_ip|too_many_requests_email" }`
- `500` `{ "error": "internal_error" }`
- `503` `{ "error": "temporarily_unavailable" }`

---

`GET /api/alias/list`  
Como chamar:
```bash
curl -X GET "https://mail.haltman.io/api/alias/list?limit=50&offset=0" \
  -H "X-API-Key: <API_KEY_64_HEX>"
```
Sucesso (200):
```json
{
  "items": [
    {
      "id": 123,
      "address": "time@thc.org",
      "goto": "dev@exemplo.com",
      "active": 1,
      "domain_id": 1,
      "created": "2026-02-18T10:00:00.000Z",
      "modified": "2026-02-18T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```
Possíveis erros:
- `400` `{ "error": "invalid_params", "field": "limit" }`
- `400` `{ "error": "invalid_params", "field": "offset" }`
- `401` `{ "error": "missing_api_key" }`
- `401` `{ "error": "invalid_api_key_format" }`
- `401` `{ "error": "invalid_or_expired_api_key" }`
- `429` `{ "error": "rate_limited", "where": "alias_list", "reason": "too_many_requests_key" }`
- `500` `{ "error": "internal_error" }`

---

`GET /api/alias/stats`  
Como chamar:
```bash
curl -X GET "https://mail.haltman.io/api/alias/stats" \
  -H "X-API-Key: <API_KEY_64_HEX>"
```
Sucesso (200):
```json
{
  "totals": 12,
  "active": 12,
  "created_last_7d": 3,
  "modified_last_24h": 1,
  "by_domain": [
    { "domain": "thc.org", "total": 12, "active": 12 }
  ]
}
```
Possíveis erros:
- `401` `{ "error": "missing_api_key" }`
- `401` `{ "error": "invalid_api_key_format" }`
- `401` `{ "error": "invalid_or_expired_api_key" }`
- `429` `{ "error": "rate_limited", "where": "alias_list", "reason": "too_many_requests_key" }`
- `500` `{ "error": "internal_error" }`

---

`GET /api/activity`  
Como chamar:
```bash
curl -X GET "https://mail.haltman.io/api/activity?limit=50&offset=0" \
  -H "X-API-Key: <API_KEY_64_HEX>"
```
Sucesso (200):
```json
{
  "items": [
    {
      "type": "alias_create",
      "occurred_at": "2026-02-18T11:22:33.000Z",
      "route": "/api/alias/create",
      "intent": null,
      "alias": null
    },
    {
      "type": "confirm_subscribe",
      "occurred_at": "2026-02-17T09:10:11.000Z",
      "route": "/forward/confirm",
      "intent": "subscribe",
      "alias": "time@thc.org"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0
  }
}
```
Possíveis erros:
- `400` `{ "error": "invalid_params", "field": "limit" }`
- `400` `{ "error": "invalid_params", "field": "offset" }`
- `401` `{ "error": "missing_api_key" }`
- `401` `{ "error": "invalid_api_key_format" }`
- `401` `{ "error": "invalid_or_expired_api_key" }`
- `429` `{ "error": "rate_limited", "where": "alias_list", "reason": "too_many_requests_key" }`
- `500` `{ "error": "internal_error" }`

---

`POST /api/alias/create`  
Como chamar:
```bash
curl -X POST "https://mail.haltman.io/api/alias/create" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY_64_HEX>" \
  -d '{"alias_handle":"time","alias_domain":"thc.org"}'
```
Sucesso (200):
```json
{
  "ok": true,
  "created": true,
  "address": "time@thc.org",
  "goto": "dev@exemplo.com"
}
```
Possíveis erros:
- `400` `{ "error": "invalid_params", "field": "alias_handle" }`
- `400` `{ "error": "invalid_params", "field": "alias_domain" }`
- `400` `{ "error": "invalid_domain", "field": "alias_domain" }`
- `401` `{ "error": "missing_api_key" }`
- `401` `{ "error": "invalid_api_key_format" }`
- `401` `{ "error": "invalid_or_expired_api_key" }`
- `409` `{ "ok": false, "error": "alias_taken", "address": "time@thc.org" }`
- `429` `{ "error": "rate_limited", "where": "alias_create", "reason": "too_many_requests_key" }`
- `500` `{ "error": "internal_error" }`

---

`POST /api/alias/delete`  
Como chamar:
```bash
curl -X POST "https://mail.haltman.io/api/alias/delete" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY_64_HEX>" \
  -d '{"alias":"time@thc.org"}'
```
Sucesso (200):
```json
{
  "ok": true,
  "deleted": true,
  "alias": "time@thc.org"
}
```
Possíveis erros:
- `400` `{ "error": "invalid_params", "field": "alias" }`
- `401` `{ "error": "missing_api_key" }`
- `401` `{ "error": "invalid_api_key_format" }`
- `401` `{ "error": "invalid_or_expired_api_key" }`
- `403` `{ "error": "forbidden" }`
- `404` `{ "error": "alias_not_found", "alias": "time@thc.org" }`
- `429` `{ "error": "rate_limited", "where": "alias_delete", "reason": "too_many_requests_key" }`
- `500` `{ "error": "internal_error" }`