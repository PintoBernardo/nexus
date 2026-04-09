# Devices API

Physical device (phone/peer) management — tracks Cisco IP phones, SIP peers, and other endpoints.

## Endpoints

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/devices` | `devices:read` | List all devices |
| `GET` | `/api/devices?user_id=X` | `devices:read` | List devices for a user |
| `GET` | `/api/devices?status=X` | `devices:read` | Filter by status |
| `GET` | `/api/devices/:id` | `devices:read` | Get a single device |
| `GET` | `/api/devices/model/:model` | `devices:read` | Devices by phone model |
| `POST` | `/api/devices` | `devices:write` | Create device |
| `PUT` | `/api/devices/:id` | `devices:write` | Update device |
| `DELETE` | `/api/devices/:id` | `devices:delete` | Delete device |

## GET /api/devices

List all devices. Optional filters: `?user_id=X` or `?status=X` (e.g. `registered`, `unregistered`).

**Response:**
```json
{
  "ok": true,
  "count": 2,
  "devices": [
    {
      "id": 1,
      "user_id": 2,
      "mac_address": "00:11:22:33:44:55",
      "ip_address": "192.168.1.100",
      "model": "Cisco 8841",
      "hostname": "SEP001122334455",
      "status": "registered",
      "last_registered": "2026-04-06T10:00:00Z",
      "created_at": "2026-04-06T09:00:00Z",
      "updated_at": "2026-04-06T10:00:00Z"
    }
  ]
}
```

## POST /api/devices

Register a new device.

**Body:**
```json
{
  "mac_address": "00:11:22:33:44:55",
  "model": "Cisco 8841",
  "ip_address": "192.168.1.100",
  "hostname": "SEP001122334455",
  "status": "registered"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `mac_address` | Yes | Device MAC address (auto-uppercased) |
| `model` | Yes | Phone model name (must exist in `phone_models`) |
| `user_id` | No | Owner user ID |
| `ip_address` | No | Current IP address |
| `hostname` | No | Device hostname |
| `status` | No | Registration status (default: `"unregistered"`) |
| `last_registered` | No | Timestamp of last registration |

## PUT /api/devices/:id

Update a device. Send only the fields you want to change.

## GET /api/devices/model/:model

Get all devices of a specific phone model.

## DELETE /api/devices/:id

Delete a device by ID.
