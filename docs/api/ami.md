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

### Request

```
POST /api/ami/command
Content-Type: application/json

{
  "action": "CoreShowChannels"
}
```

### Common Actions

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

### Response — 200 OK

```json
{
  "ok": true,
  "messages": [
    "Response: Success\r\nEventList: start\r\nMessage: Events will follow"
  ]
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
  "detail": "AMI command timed out after 5s"
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
