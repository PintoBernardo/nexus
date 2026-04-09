# Ring Groups API

Ring group management — groups of extensions that ring together. Stored locally in the DB, each ring group can link to multiple extensions by number.

## Endpoints

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/ringgroups/:id` | `ringgroups:read` | Get a single ring group with members |
| `POST` | `/api/ringgroups` | `ringgroups:write` | Create ring group |
| `PUT` | `/api/ringgroups/:id` | `ringgroups:write` | Update ring group |
| `DELETE` | `/api/ringgroups/:id` | `ringgroups:delete` | Delete ring group |
| `POST` | `/api/ringgroups/:id/members/:extension` | `ringgroups:write` | Add extension number to group |
| `DELETE` | `/api/ringgroups/:id/members/:extension` | `ringgroups:write` | Remove extension number from group |
| `PUT` | `/api/ringgroups/:id/members` | `ringgroups:write` | Replace all members by extension numbers |

## Strategies

| Strategy | Description |
|----------|-------------|
| `ringall` | All extensions ring simultaneously |
| `hunt` | Ring extensions in order until someone answers |
| `memoryhunt` | Hunt mode that remembers last answered position |

## GET /api/ringgroups/:id

Get a single ring group with its members.

**Response:**
```json
{
  "ok": true,
  "ringGroup": {
    "id": 1,
    "name": "Sales Team",
    "strategy": "ringall",
    "description": "Sales department",
    "created_at": "2026-04-06T10:00:00Z",
    "updated_at": "2026-04-06T10:00:00Z",
    "members": [
      { "extension": "101", "display_name": "John Doe", "type": "sip", "priority": 0 },
      { "extension": "102", "display_name": "Jane Smith", "type": "sip", "priority": 0 }
    ]
  }
}
```

## POST /api/ringgroups

Create a new ring group. Optionally pass `members` as an array of extension numbers.

**Body:**
```json
{
  "name": "Support Team",
  "strategy": "hunt",
  "description": "Support department",
  "members": ["101", "102"]
}
```

## PUT /api/ringgroups/:id

Update a ring group. Send only the fields you want to change.

## DELETE /api/ringgroups/:id

Delete a ring group by ID.

## POST /api/ringgroups/:id/members/:extension

Add an extension number to a ring group.

## DELETE /api/ringgroups/:id/members/:extension

Remove an extension number from a ring group.

## PUT /api/ringgroups/:id/members

Replace all members of a ring group using extension numbers.

**Body:**
```json
{
  "members": ["101", "102", "103"]
}
```
