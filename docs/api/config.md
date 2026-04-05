# Config API — Read/Write All Settings

All Nexus settings are stored in the database and cached in memory.
These endpoints let you manage every setting at runtime without restarting.

---

## GET /api/config — List All Settings

Returns every configuration entry. Optionally filter by group.

### Request

```
GET /api/config
GET /api/config?group=freepbx
```

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `group` | string | No | Filter by group (e.g. `server`, `freepbx`, `ami`, `cache`) |

### Response — 200 OK

```json
[
  {
    "key": "server.host",
    "value": "0.0.0.0",
    "group": "server",
    "label": "Bind address",
    "type": "string"
  },
  {
    "key": "server.port",
    "value": "8000",
    "group": "server",
    "label": "HTTP listen port",
    "type": "number"
  }
]
```

---

## GET /api/config/:key — Get a Single Setting

### Request

```
GET /api/config/freepbx.api_url
```

### Response — 200 OK

```json
{
  "key": "freepbx.api_url",
  "value": "http://192.168.1.160:83",
  "group": "freepbx",
  "label": "FreePBX API base URL",
  "type": "string"
}
```

### Response — 404 Not Found

```json
{
  "error": "Config key not found",
  "key": "freepbx.api_url"
}
```

---

## PUT /api/config/:key — Create or Update a Setting

### Request

```
PUT /api/config/freepbx.api_url
Content-Type: application/json

{
  "value": "http://192.168.1.160:83",
  "group": "freepbx",
  "label": "FreePBX API base URL",
  "type": "string"
}
```

### Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | string | Yes | The new value |
| `group` | string | No | Logical group (default: `"general"`) |
| `label` | string | No | Human-readable description |
| `type` | string | No | One of: `string`, `number`, `boolean`, `secret` |

### Response — 200 OK

```json
{
  "ok": true,
  "key": "freepbx.api_url",
  "value": "http://192.168.1.160:83",
  "group": "freepbx"
}
```

### Response — 400 Bad Request

```json
{
  "error": "Missing 'value' in request body"
}
```

---

## DELETE /api/config/:key — Delete a Setting

### Request

```
DELETE /api/config/cache.router_expire
```

### Response — 200 OK

```json
{
  "ok": true,
  "deleted": "cache.router_expire"
}
```

---

## POST /api/config/reload — Force Cache Reload

Forces a full reload of the config cache from the database.

### Request

```
POST /api/config/reload
```

### Response — 200 OK

```json
{
  "ok": true,
  "count": 12
}
```
