# Database — Universal CRUD API

All database endpoints require authentication. Some (write operations) require admin role.

---

## GET /api/db/tables — List Tables

Returns all table names.

### Response — 200 OK

```json
{
  "ok": true,
  "tables": ["configs", "users", "extensions", "devices", "phone_models"]
}
```

---

## GET /api/db/:table/schema — Get Table Structure

### Response — 200 OK

```json
{
  "ok": true,
  "table": "extensions",
  "schema": [
    { "name": "id", "type": "INTEGER", "pk": 1 },
    { "name": "user_id", "type": "INTEGER", "pk": 0 },
    { "name": "type", "type": "TEXT", "pk": 0 },
    { "name": "extension", "type": "TEXT", "pk": 0 },
    { "name": "display_name", "type": "TEXT", "pk": 0 },
    { "name": "enabled", "type": "INTEGER", "pk": 0 }
  ]
}
```

---

## POST /api/db/:table — Insert Row

Admin-only. Body contains column values.

### Request

```
POST /api/db/phone_models
Content-Type: application/json

{
  "model": "CP-7841",
  "manufacturer": "Cisco",
  "screen_resolution": "396x158",
  "screen_size": "3.5\"",
  "screen_color": "256-color",
  "num_lines": 10,
  "num_softkeys": 4,
  "num_line_keys": 10,
  "expansion_module": "none",
  "has_wifi": 0,
  "has_poe": 1,
  "has_bluetooth": 0,
  "usb_ports": 0,
  "network_ports": 2,
  "form_factor": "desk",
  "protocol": "sccp",
  "notes": "Entry-level IP phone"
}
```

### Response — 201 Created

```json
{
  "ok": true,
  "id": 1,
  "changes": 1
}
```

---

## GET /api/db/:table — List Rows

Paginated. `?limit=50&offset=0` by default.

### Response — 200 OK

```json
{
  "ok": true,
  "count": 3,
  "rows": [
    { "id": 1, "model": "CP-7841", "has_poe": 1 },
    { "id": 2, "model": "CP-7861", "has_poe": 1 },
    { "id": 3, "model": "CP-8845", "has_poe": 1 }
  ]
}
```

### Search with `?field=value`

```
GET /api/db/phone_models?has_wifi=1&network_ports=2
```

---

## GET /api/db/:table/:id — Get Row by ID

### Response — 200 OK

```json
{
  "ok": true,
  "row": {
    "id": 1,
    "model": "CP-7841",
    "manufacturer": "Cisco",
    "has_poe": 1
  }
}
```

---

## PUT /api/db/:table/:id — Update Row

Admin-only. Body contains only the columns to update.

### Request

```
PUT /api/db/phones/1
Content-Type: application/json

{
  "model": "CP-1000",
  "ip_address": "192.168.129"
}
```

### Response — 200 OK

```json
{
  "ok": true,
  "changes": 1
}
```

---

## DELETE /api/db/:table/:id — Delete Row

Admin-only.

### Request

```
DELETE /api/db/users/5
```

### Response — 200 OK

```json
{
  "ok": true,
  "deleted": { "table": "users", "id": 5 }
}
```

### Response — 404 Not Found

```json
{
  "error": "Row not found",
  "table": "users",
  "id": 99
}
```
