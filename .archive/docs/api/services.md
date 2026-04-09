# Services — Phone Services Architecture

## Two-Layer Architecture

```
Cisco IP Phone  ──HTTP──>  /services/*  (port 8001, XML frontend)
                               │
                               └── calls ──>  /api/services/*  (port 8000, JSON backend)
                                                  │
                                                  ├── services_status table (enable/disable)
                                                  ├── personal_directory table
                                                  ├── users.services_pin
                                                  └── FreePBX API (corporate)
```

### Backend (`/api/services/*` — port 8000)
JSON API endpoints. Auth via `username` + `services_pin` (not JWT).

### Frontend (`/services/*` — port 8001)
Standalone Express server serving CiscoIPPhone XML. Calls the API internally.

### Service Enable/Disable (`services_status` table)
All services are tracked in the `services_status` DB table. The backend reads this table and the frontend requests `/api/services/status` to know what to display.

| Field | Description |
|-------|-------------|
| `name` | Service identifier (e.g. `directory`) |
| `label` | Display name on phone menu |
| `description` | Human-readable description |
| `enabled` | 1 = visible, 0 = hidden |
| `url` | URL path on the XML server |
| `port` | XML server port |

## API Endpoints

### Services Status
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/services/status` | List all services with enabled state |
| `GET` | `/api/services/status/:name` | Get a single service's status |
| `PUT` | `/api/services/status/:name` | Toggle a service on/off |

### Directory (JSON Backend)
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/services/directory/menu` | Enabled services config |
| `GET` | `/api/services/directory/personal?username=X&pin=Y` | User's contacts |
| `POST` | `/api/services/directory/personal/contact` | Add/edit/delete/reorder contact |
| `GET` | `/api/services/directory/personal/security?username=X&pin=Y` | PIN status |
| `POST` | `/api/services/directory/personal/pin` | Set/disable PIN |
| `GET` | `/api/services/directory/corporate?firstname=X&lastname=Y&number=Z` | Corporate search |

### Directory (XML Frontend)
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/services/directory` | Top-level menu |
| `GET` | `/services/directory/personal` | Login form or contacts |
| `GET` | `/services/directory/personal/add?username=X&pin=Y` | Add contact form |
| `GET` | `/services/directory/corporate` | Search form or results |

## Running

```bash
# Start both API and Phone Services together (recommended)
npm run start:all

# Or start them individually:
# API on port 8000
npm start

# Phone Services on port 8001
npm run services
```

## Project Structure

```
services/
├── index.js              # Main entry — mounts all service routers
├── config.js             # Shared config: DB, API client, helpers
└── directory/
    └── index.js          # Directory service routes (personal + corporate)
```

Each service lives in its own folder under `services/<name>/index.js` and mounts as an Express router at `/services/<name>/*`. To add a new service:

1. Create `services/<name>/index.js` with an Express router
2. Mount it in `services/index.js`:
   ```js
   const myServiceRouter = require("./my-service");
   app.use("/services/my-service", myServiceRouter);
   ```
3. Add a row to `services_status` via seed or DB migration
