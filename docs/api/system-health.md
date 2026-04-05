# GET /api/system/health — System Health Check

Returns the API status, version, uptime, and submodule connection status.

## Request

```
GET /api/system/health
```

No parameters or authentication required.

## Response — 200 OK

```json
{
  "project": "Nexus",
  "status": "online",
  "version": "1.0.0",
  "uptime": 45.2,
  "services": {
    "freepbx": {
      "enabled": true,
      "url": "http://192.168.1.160:83"
    },
    "ami": {
      "enabled": true,
      "connected": false,
      "host": "127.0.0.1",
      "port": 5038
    }
  }
}
```

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `project` | string | Project name (always "Nexus") |
| `status` | string | Server status ("online") |
| `version` | string | Current backend version |
| `uptime` | number | Seconds since server started |
| `services.freepbx.enabled` | boolean | Whether FreePBX integration is enabled |
| `services.freepbx.url` | string | FreePBX API URL from config |
| `services.ami.enabled` | boolean | Whether AMI integration is enabled |
| `services.ami.connected` | boolean | Whether AMI socket is currently connected |
| `services.ami.host` | string | AMI server host from config |
| `services.ami.port` | number | AMI server port from config |
