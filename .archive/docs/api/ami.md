# AMI — Asterisk Manager Interface

## POST /api/ami/connect — Connect to AMI

Connects to the Asterisk Manager Interface using credentials from config.

### Request

```
POST /api/ami/connect
```

### Response — 200 OK

```json
{
  "ok": true,
  "message": "Connected to AMI"
}
```

### Response — 500 Error

```json
{
  "error": "Failed to connect to AMI",
  "detail": "connect ECONNREFUSED 127.0.0.1:5038"
}
```

---

## POST /api/ami/command — Send AMI Command

Send any AMI action. Auto-connects if not already connected.
Responses are automatically parsed from AMI text format to JSON.

### Request

```
POST /api/ami/command
Content-Type: application/json

{
  "action": "CoreShowChannels"
}
```

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `flatten` | `1` | No | Merge all response blocks into one object (useful for list commands) |

### Common Actions

#### List available commands
```json
{ "action": "ListCommands" }
```

#### Show active channels
```json
{ "action": "CoreShowChannels" }
```

#### Run Asterisk CLI command
```json
{ "action": "Command", "command": "core show channels" }
```

#### Originate a call
```json
{
  "action": "Originate",
  "params": {
    "Channel": "SIP/100",
    "Exten": "200",
    "Context": "from-internal",
    "Priority": "1"
  }
}
```

### Response — 200 OK (default, array of parsed objects)

```json
{
  "ok": true,
  "data": [
    {
      "response": "Success",
      "eventList": "start",
      "actionId": "nexus-1"
    },
    {
      "event": "CoreShowChannel",
      "channel": "SIP/100-00000001",
      "state": "Up",
      "callerId": "Alice"
    },
    {
      "event": "CoreShowChannel",
      "channel": "SIP/101-00000002",
      "state": "Idle",
      "callerId": "Bob"
    },
    {
      "event": "ListComplete",
      "totalItems": "2"
    }
  ]
}
```

### Response — 200 OK (with `?flatten=1`)

```json
{
  "ok": true,
  "data": {
    "response": "Success",
    "eventList": "start",
    "actionId": "nexus-1",
    "event": ["CoreShowChannel", "CoreShowChannel", "ListComplete"],
    "totalItems": "2"
  }
}
```

### Response — 400 Bad Request

```json
{
  "error": "Missing 'action' in request body"
}
```

### Response — 500 Error

```json
{
  "error": "AMI command failed",
  "detail": "[ami] Command timed out after 15s: {\"action\":\"CoreShowChannels\"}"
}
```

---

## GET /api/ami/status — Check AMI Connection Status

### Request

```
GET /api/ami/status
```

### Response — 200 OK

```json
{
  "connected": true,
  "enabled": true,
  "host": "127.0.0.1",
  "port": 5038
}
```

---

## POST /api/ami/disconnect — Disconnect from AMI

### Request

```
POST /api/ami/disconnect
```

### Response — 200 OK

```json
{
  "ok": true,
  "message": "Disconnected from AMI"
}
```

---

## AMI Response Parser

All AMI text responses (`key: value\r\n` format) are automatically parsed
to JSON objects using `api/src/utils/amiParser.js`.

Keys are converted to camelCase:
- `"Response"` → `"response"`
- `"ActionID"` → `"actionId"`
- `"EventList"` → `"eventList"`

Multiple values for the same key are collected into arrays:
```json
{ "variables": ["CHANNEL=/100", "STATE=Idle"] }
```
