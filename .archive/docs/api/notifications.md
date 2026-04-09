# Notifications API

System-generated notifications — sync mismatches, connection errors, startup warnings. Stored in-memory with type-based filtering.

## Endpoints

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/notify` | None | List all notifications |
| `GET` | `/api/notify?type=error` | None | Filter by type |
| `GET` | `/api/notify/summary` | None | Count by type |
| `DELETE` | `/api/notify/:id` | None | Dismiss a notification |
| `DELETE` | `/api/notify?type=error` | None | Dismiss all of a type |
| `DELETE` | `/api/notify/all` | None | Dismiss all notifications |

## Notification Types

| Type | Description |
|------|-------------|
| `error` | Something failed (sync error, connection lost) |
| `warning` | Potential issue that needs attention |
| `info` | Informational message |
| `sync` | Extension sync mismatch between local DB and FreePBX |

## GET /api/notify

List all notifications. Optional `?type=X` filter.

**Response:**
```json
{
  "ok": true,
  "count": 2,
  "notifications": [
    {
      "id": 1,
      "type": "sync",
      "message": "Extensions in local DB but not in FreePBX: 122, 123",
      "source": "startup-sync",
      "timestamp": "2026-04-06T08:00:00.000Z"
    },
    {
      "id": 2,
      "type": "error",
      "message": "FreePBX connection timed out",
      "source": "freepbx-service",
      "timestamp": "2026-04-06T08:05:00.000Z"
    }
  ]
}
```

## GET /api/notify/summary

Get count of notifications grouped by type.

**Response:**
```json
{
  "ok": true,
  "total": 5,
  "byType": {
    "error": 1,
    "warning": 1,
    "info": 2,
    "sync": 1
  }
}
```

## DELETE /api/notify/:id

Dismiss (remove) a single notification by ID.

## DELETE /api/notify?type=error

Dismiss all notifications of a specific type.

## DELETE /api/notify/all

Clear all notifications.
