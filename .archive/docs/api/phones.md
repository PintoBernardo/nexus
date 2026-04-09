# Phone Models API

Phone model catalog — specifications for supported Cisco IP phones. Devices reference models via the `model` column.

## Endpoints

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/phones` | `devices:read` | List all phone models |
| `GET` | `/api/phones?manufacturer=Cisco` | `devices:read` | Filter by manufacturer |
| `GET` | `/api/phones?protocol=sccp` | `devices:read` | Filter by protocol |
| `GET` | `/api/phones/:model` | `devices:read` | Get a specific model |
| `POST` | `/api/phones` | `devices:write` | Create phone model |
| `PUT` | `/api/phones/:model` | `devices:write` | Update phone model |
| `DELETE` | `/api/phones/:model` | `devices:write` | Delete phone model |

## GET /api/phones

List all phone models. Optional filters: `?manufacturer=X` or `?protocol=X`.

**Response:**
```json
{
  "ok": true,
  "count": 3,
  "models": [
    {
      "model": "Cisco 8841",
      "manufacturer": "Cisco",
      "screen_resolution": "480x272",
      "screen_size": "5\"",
      "screen_color": "color",
      "num_lines": 4,
      "num_softkeys": 4,
      "num_line_keys": 4,
      "expansion_module": "none",
      "has_wifi": 0,
      "has_poe": 1,
      "has_bluetooth": 0,
      "usb_ports": 0,
      "network_ports": 2,
      "form_factor": "desktop",
      "protocol": "sccp",
      "notes": ""
    }
  ]
}
```

## POST /api/phones

Add a phone model to the catalog.

**Body:**
```json
{
  "model": "Cisco 8861",
  "manufacturer": "Cisco",
  "screen_resolution": "480x272",
  "num_lines": 6,
  "num_softkeys": 6,
  "protocol": "sccp",
  "has_poe": true
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `model` | Yes | Model identifier (e.g. `"Cisco 8861"`) |
| `manufacturer` | No | Default: `"Cisco"` |
| `screen_resolution` | No | e.g. `"480x272"` |
| `screen_size` | No | e.g. `"5\""` |
| `screen_color` | No | e.g. `"color"` or `"mono"` |
| `num_lines` | No | Max display lines (default: `0`) |
| `num_softkeys` | No | Softkey count (default: `0`) |
| `num_line_keys` | No | Physical line keys (default: `0`) |
| `expansion_module` | No | e.g. `"none"`, `"8832"` |
| `has_wifi` | No | Boolean (default: `false`) |
| `has_poe` | No | Boolean (default: `false`) |
| `has_bluetooth` | No | Boolean (default: `false`) |
| `usb_ports` | No | USB port count (default: `0`) |
| `network_ports` | No | Ethernet ports (default: `1`) |
| `form_factor` | No | e.g. `"desktop"` |
| `protocol` | No | Default: `"sccp"` |
| `notes` | No | Free text |

## PUT /api/phones/:model

Update a phone model's specs. Send only changed fields.

## DELETE /api/phones/:model

Delete a phone model. Fails if any devices reference it (foreign key restriction).
