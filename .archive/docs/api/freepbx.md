# FreePBX API Integration

## GET /api/freepbx/extensions — Fetch All Extensions

Returns the list of extensions from FreePBX.

### Request

```
GET /api/freepbx/extensions
```

### Response — 200 OK

```json
{
  "ok": true,
  "count": 2,
  "extensions": [
    {
      "extensionId": "100",
      "user": {
        "name": "John Doe"
      }
    },
    {
      "extensionId": "101",
      "user": {
        "name": "Jane Smith"
      }
    }
  ]
}
```

### Response — 503 Service Unavailable (disabled)

```json
{
  "error": "FreePBX integration is disabled",
  "hint": "Set freepbx.enabled = true in config"
}
```

### Response — 500 Error

```json
{
  "error": "Failed to fetch extensions",
  "detail": "FreePBX GraphQL error: [...]"
}
```

---

## GET /api/freepbx/token — Refresh OAuth Token

Forces a fresh OAuth token from FreePBX. Useful for testing connectivity.

### Request

```
GET /api/freepbx/token
```

### Response — 200 OK

```json
{
  "ok": true,
  "token": "eyJhbGciOiJIUz..."
}
```
