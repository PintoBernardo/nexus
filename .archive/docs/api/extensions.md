# Extensions API

Extension management — phone lines (SIP/PJSIP/SCCP) stored in the local SQLite database.

## Endpoints

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/extensions?user_id=X` | `extensions:read` | List extensions for a user |
| `GET` | `/api/extensions/:id` | `extensions:read` | Get a single extension |
| `POST` | `/api/extensions` | `extensions:write` | Create extension |
| `PUT` | `/api/extensions/:id` | `extensions:write` | Update extension |
| `DELETE` | `/api/extensions/:id` | `extensions:delete` | Delete extension |

## GET /api/extensions?user_id=X

List extensions for a specific user. `user_id` query parameter is required.

**Response:**
```json
{
  "ok": true,
  "count": 2,
  "extensions": [
    {
      "id": 1,
      "user_id": 2,
      "type": "sip",
      "extension": "101",
      "secret": "s3cret",
      "display_name": "John Doe",
      "context": "from-internal",
      "enabled": 1,
      "created_at": "2026-04-06T10:00:00Z",
      "updated_at": "2026-04-06T10:00:00Z"
    }
  ]
}
```

## GET /api/extensions/:id

Get a single extension by ID.

**Response:**
```json
{
  "ok": true,
  "extension": {
    "id": 1,
    "user_id": 2,
    "type": "sip",
    "extension": "101",
    "secret": "s3cret",
    "display_name": "John Doe",
    "context": "from-internal",
    "enabled": 1,
    "created_at": "2026-04-06T10:00:00Z",
    "updated_at": "2026-04-06T10:00:00Z"
  }
}
```

## POST /api/extensions

Create a new extension.

**Body:**
```json
{
  "user_id": 2,
  "type": "sip",
  "extension": "122",
  "secret": "s3cret",
  "display_name": "John Doe",
  "context": "from-internal",
  "enabled": true
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `user_id` | No | Owner user ID |
| `type` | Yes | Protocol: `sip`, `sccp`, or `pjsip` |
| `extension` | Yes | Extension number (e.g. `"122"`) |
| `secret` | No | SIP secret/password |
| `display_name` | No | Human-readable name |
| `context` | No | Asterisk dialplan context (default: `"from-internal"`) |
| `enabled` | No | Whether the extension is active (default: `true`) |

## PUT /api/extensions/:id

Update an extension. Send only the fields you want to change.

**Body:**
```json
{
  "display_name": "Jane Smith",
  "enabled": false
}
```

## DELETE /api/extensions/:id

Delete an extension by ID.
