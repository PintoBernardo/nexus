# Nexus Unified Communications

Nexus Unified Communications is an open-source backend for enterprise Cisco IP phones and Asterisk/FreePBX systems. It replaces Cisco CUCM for phone provisioning, directory services, and device management — without requiring a CUCM server.

## What It Does

- **Phone Services** — Serve Cisco IPPhone XML menus (directories, information, reports) directly from the API
- **SEP Config Generation** — Generate phone configuration files from templates, like CUCM does
- **FreePBX Integration** — Pull extensions and data from FreePBX via its GraphQL API
- **AMI Integration** — Send Asterisk Manager Interface commands (originate calls, show channels, etc.) through HTTP
- **Database-Driven Config** — Every setting lives in a SQLite database with an in-memory cache. All values readable and writable at runtime via the API — zero restarts, zero hardcoded values

## Architecture

```
Nexus Unified Communications
├── api/                        # Express.js backend
│   └── src/
│       ├── config/            # Database connection & config cache
│       │   ├── db.js          # SQLite with migration system
│       │   └── configStore.js # Key/value store with in-memory cache
│       ├── services/          # Business logic
│       │   ├── ami.js         # Persistent AMI socket connection
│       │   └── freepbx.js     # FreePBX GraphQL API proxy
│       ├── routers/           # HTTP endpoints
│       │   ├── system/
│       │   │   └── health.js  # Health check with service status
│       │   ├── config/        # CRUD for all settings
│       │   ├── freepbx/       # Extensions, token refresh
│       │   └── ami/           # AMI connect, command, disconnect
│       ├── middleware/         # Express middleware
│       │   └── logger.js      # Color-coded request logging
│       ├── utils/
│       │   └── seed.js        # Default settings initializer
│       └── app.js             # Express entry point
├── cisco-phones/              # Phone configs (templates, output)
├── frontend/                  # Web UI (future)
├── bruno/Nexus/               # API test collection (Bruno)
├── docs/api/                  # Endpoint documentation
├── start.bat                  # Windows launcher
└── nexus.db                   # Application database (auto-created)
```

## API Endpoints

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/system/health` | Server status and service health |

### Config
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/config` | List all settings (`?group=xxx`) |
| `GET` | `/api/config/:key` | Get a single setting |
| `PUT` | `/api/config/:key` | Create or update a setting |
| `DELETE` | `/api/config/:key` | Delete a setting |
| `POST` | `/api/config/reload` | Force cache reload |

### FreePBX
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/freepbx/extensions` | Fetch all extensions |
| `GET` | `/api/freepbx/token` | Refresh OAuth token |

### AMI
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ami/connect` | Connect to Asterisk Manager Interface |
| `POST` | `/api/ami/command` | Send an AMI command |
| `GET` | `/api/ami/status` | Check AMI connection status |
| `POST` | `/api/ami/disconnect` | Disconnect from AMI |

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+

### 1. Clone
```bash
git clone https://github.com/YOUR_USERNAME/nexus.git
cd nexus
```

### 2. Install
```bash
# Windows
start.bat

# Manual
npm install
npm run seed   # initialize database with default settings
```

### 3. Run
```bash
npm start        # production
npm run dev      # auto-restart on file changes
```

Server starts at `http://localhost:8000`.

### 4. Test with Bruno
Open the `bruno/Nexus/` collection in [Bruno](https://www.usebruno.com/) to test all endpoints with pre-filled examples.

## Configuration

All settings are stored in `nexus.db` and managed through the `/api/config` endpoint. Default values:

| Key | Default | Description |
|-----|---------|-------------|
| `server.host` | `0.0.0.0` | Bind address |
| `server.port` | `8000` | HTTP listen port |
| `freepbx.enabled` | `true` | Enable FreePBX integration |
| `freepbx.api_url` | `http://127.0.0.1` | FreePBX API URL |
| `ami.enabled` | `true` | Enable AMI integration |
| `ami.host` | `127.0.0.1` | AMI server host |
| `ami.port` | `5038` | AMI server port |
| `ami.username` | `admin` | AMI login username |
| `ami.timeout` | `15` | AMI command timeout (seconds) |

Update any value at runtime:
```bash
curl -X PUT http://localhost:8000/api/config/server.port \
  -H "Content-Type: application/json" \
  -d '{"value": "9000"}'
```

## Project Status

- [x] Database-driven config system
- [x] FreePBX GraphQL integration
- [x] AMI connection service
- [x] API endpoints (config, freepbx, ami)
- [x] Bruno test collection
- [x] Documentation
- [ ] Phone services (directories, XML menus)
- [ ] SEP config generation (templates)
- [ ] TFTP file serving
- [ ] Web frontend
- [ ] Module/plugin system

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** SQLite (better-sqlite3)
- **API Testing:** Bruno

## License

ISC — Bernardo Pinto
