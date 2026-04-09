# Permissions Reference

Every endpoint and the permission required to access it.

The **admin** role always passes all permission checks (hardcoded in `hasPermission`).
Suspended users (`suspended=1`) always fail — zero permissions.

## Permission Matrix

| Permission | Description |
|------------|-------------|
| `health:read` | Public endpoints, profile, own permissions |
| `configs:read` | Read config settings |
| `configs:write` | Update/delete config, reload cache |
| `freepbx:read` | Query FreePBX |
| `freepbx:write` | Modify FreePBX (future) |
| `ami:read` | AMI status and connect |
| `ami:write` | AMI commands |
| `db:read` | Read DB tables |
| `db:write` | Write/delete DB tables |
| `users:read` | List and view users |
| `users:write` | Create and edit users |
| `users:delete` | Delete and suspend users |
| `roles:read` | List roles with permissions |
| `roles:write` | Add/remove permissions from roles |
| `extensions:read` | List and view extensions |
| `extensions:write` | Create and edit extensions |
| `extensions:delete` | Delete extensions |
| `devices:read` | List and view devices |
| `devices:write` | Create and edit devices |
| `devices:delete` | Delete devices |
| `ringgroups:read` | List and view ring groups |
| `ringgroups:write` | Create, edit, sync ring groups |
| `ringgroups:delete` | Delete ring groups |
| `services:read` | View service status |
| `services:write` | Toggle services on/off |

## Endpoint → Permission Mapping

### System (Public)
| Endpoint | Permission |
|----------|------------|
| `GET /api/system/health` | none |

### Auth
| Endpoint | Permission |
|----------|------------|
| `POST /api/auth/login` | none |
| `POST /api/auth/verify` | none |
| `GET /api/auth/profile` | `health:read` |
| `GET /api/auth/permissions` | `health:read` |
| `POST /api/auth/register` | `users:write` |
| `GET /api/auth/users` | `users:read` |
| `GET /api/auth/users/:id` | `users:read` |
| `PUT /api/auth/users/:id` | `users:write` |
| `DELETE /api/auth/users/:id` | `users:delete` |
| `POST /api/auth/users/:id/suspend` | `users:delete` |
| `POST /api/auth/users/:id/unsuspend` | `users:delete` |
| `GET /api/auth/roles` | `roles:read` |
| `POST /api/auth/roles/:name/perms` | `roles:write` |
| `DELETE /api/auth/roles/:name/perms/:permission` | `roles:write` |

### Config
| Endpoint | Permission |
|----------|------------|
| `GET /api/config` | `configs:read` |
| `GET /api/config/:key` | `configs:read` |
| `PUT /api/config/:key` | `configs:write` |
| `DELETE /api/config/:key` | `configs:write` |
| `POST /api/config/reload` | `configs:write` |

### FreePBX
| Endpoint | Permission |
|----------|------------|
| `GET /api/freepbx/extensions` | `freepbx:read` |
| `GET /api/freepbx/token` | `freepbx:read` |

### AMI
| Endpoint | Permission |
|----------|------------|
| `POST /api/ami/connect` | `ami:read` |
| `POST /api/ami/command` | `ami:write` |
| `GET /api/ami/status` | `ami:read` |
| `POST /api/ami/disconnect` | `ami:read` |

### DB
| Endpoint | Permission |
|----------|------------|
| `GET /api/db/tables` | `db:read` |
| `GET /api/db/:table/schema` | `db:read` |
| `GET /api/db/:table` | `db:read` |
| `GET /api/db/:table/:id` | `db:read` |
| `POST /api/db/:table` | `db:write` |
| `PUT /api/db/:table/:id` | `db:write` |
| `DELETE /api/db/:table/:id` | `db:write` |

## Default Roles

### `admin`
```
*  (all permissions, hardcoded in code)
```

### `manager`
```
users:read, users:write, extensions:read, extensions:write,
devices:read, devices:write, db:read, freepbx:read, ami:read, ami:write,
configs:read, configs:write, roles:read, roles:write, health:read
```

### `operator`
```
users:read, extensions:read, devices:read, configs:read,
db:read, freepbx:read, ami:read, roles:read, health:read
```

### `user`
```
configs:read, health:read
```

## Suspended Users

Users with `suspended = 1` have **zero permissions**. They cannot:
- Log in (login returns "Account is suspended")
- Use any API endpoint (even `health:read`) — because their token will fail `hasPermission`

To suspend:
```
POST /api/auth/users/:id/suspend
```

To unsuspend:
```
POST /api/auth/users/:id/unsuspend
```

## Adding a Custom Role

1. Add the role: `POST /api/auth/register` with `"role": "myrole"`
2. Add the role to the roles table via DB:
```
POST /api/db/roles
{ "name": "myrole", "label": "My Role", "description": "..." }
```
3. Add permissions:
```
POST /api/auth/roles/myrole/perms
{ "permission": "db:read" }
```
