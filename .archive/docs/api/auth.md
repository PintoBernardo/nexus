# Auth — Authentication, Users & Roles

## Public Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/login` | Authenticate → returns JWT token |
| `POST` | `/api/auth/verify` | Verify a JWT token |

## My Data — `/api/me` (any authenticated user)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/me` | Own profile |
| `GET` | `/api/me/perms` | Own role and permissions |
| `GET` | `/api/me/sessions` | Own active sessions |
| `GET` | `/api/me/extensions` | Own extensions (local DB) |
| `GET` | `/api/me/devices` | Own devices (local DB) |
| `DELETE` | `/api/me/sessions/:id` | Revoke own session |
| `POST` | `/api/me/logout` | Expire current token (logout this session) |
| `POST` | `/api/me/logout-all` | Expire all own tokens (logout everywhere) |

## Admin — User Management (`users:read`, `users:write`, `users:delete`)

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `POST` | `/api/auth/register` | `users:write` | Create user → returns token |
| `GET` | `/api/auth/users` | `users:read` | List all users |
| `GET` | `/api/auth/users/:id` | `users:read` | Get user by ID |
| `PUT` | `/api/auth/users/:id` | `users:write` | Update role/suspend |
| `DELETE` | `/api/auth/users/:id` | `users:delete` | Delete user |
| `POST` | `/api/auth/users/:id/suspend` | `users:delete` | Suspend user |
| `POST` | `/api/auth/users/:id/unsuspend` | `users:delete` | Unsuspend user |
| `POST` | `/api/auth/users/:id/revoke-all-tokens` | `users:write` | Force logout user |

### User ↔ Extension Linking

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/auth/users/:id/extensions` | `users:read` | Get user's extensions |
| `POST` | `/api/auth/users/:id/extensions/:extId` | `users:write` | Link extension to user |
| `DELETE` | `/api/auth/users/:id/extensions/:extId` | `users:write` | Unlink extension from user |

### User ↔ Device Linking

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/auth/users/:id/devices` | `users:read` | Get user's devices |
| `POST` | `/api/auth/users/:id/devices/:devId` | `users:write` | Link device to user |
| `DELETE` | `/api/auth/users/:id/devices/:devId` | `users:write` | Unlink device from user |

## Admin — Role Management (`roles:read`, `roles:write`)

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/auth/roles` | `roles:read` | List all roles with permissions |
| `POST` | `/api/auth/roles` | `roles:write` | Create a new role |
| `PUT` | `/api/auth/roles/:name` | `roles:write` | Update role label/description |
| `DELETE` | `/api/auth/roles/:name` | `roles:write` | Delete a role (cannot delete `admin`) |
| `POST` | `/api/auth/roles/:name/perms` | `roles:write` | Add permission to role |
| `DELETE` | `/api/auth/roles/:name/perms/:permission` | `roles:write` | Remove permission from role |

## Admin — Sessions & Tokens

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/auth/sessions/all` | `users:read` | All active sessions |
| `POST` | `/api/auth/tokens/cleanup` | `users:write` | Clean up expired tokens |

---

## POST /api/auth/login — Authenticate

### Request

```
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "nexus1234"
}
```

### Response — 200 OK

```json
{
  "ok": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "profile": {
    "id": 1,
    "username": "admin",
    "email": "admin@nexus.local",
    "role": "admin"
  }
}
```

### Response — 401 Unauthorized

```json
{
  "error": "Invalid credentials"
}
```

---

## POST /api/auth/verify — Verify Token

### Request

```
POST /api/auth/verify
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

Or via header:

```
POST /api/auth/verify
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Response — 200 OK (valid)

```json
{
  "ok": true,
  "valid": true,
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@nexus.local",
    "role": "admin",
    "iat": 1712345678,
    "exp": 1712432078
  }
}
```

---

## POST /api/auth/register — Create User

Requires `users:write` permission.

### Request

```
POST /api/auth/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "jdoe",
  "email": "jdoe@example.com",
  "password": "secure123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1-555-0100",
  "role": "user"
}
```

### Response — 201 Created

```json
{
  "ok": true,
  "message": "User created",
  "user": {
    "id": 2,
    "username": "jdoe",
    "email": "jdoe@example.com",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## GET /api/me — Own Profile

```
GET /api/me
Authorization: Bearer <token>
```

### Response

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@nexus.local",
    "role": "admin",
    "iat": 1712345678,
    "exp": 1712432078
  }
}
```

---

## GET /api/me/perms — Own Permissions

```
GET /api/me/perms
Authorization: Bearer <token>
```

### Response

```json
{
  "ok": true,
  "role": "admin",
  "permissions": ["users:read", "users:write", "users:delete", "roles:read", "roles:write"]
}
```

---

## POST /api/me/logout — Logout Current Session

Immediately expires the current JWT token.

```
POST /api/me/logout
Authorization: Bearer <token>
```

### Response

```json
{
  "ok": true,
  "message": "Logged out successfully"
}
```

---

## POST /api/me/logout-all — Logout Everywhere

Expires ALL tokens for the requesting user.

```
POST /api/me/logout-all
Authorization: Bearer <token>
```

### Response

```json
{
  "ok": true,
  "message": "All sessions revoked",
  "revoked": 3
}
```

---

## Role CRUD

### POST /api/auth/roles — Create Role

```
POST /api/auth/roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "manager",
  "label": "Manager",
  "description": "Department manager with extended permissions"
}
```

### PUT /api/auth/roles/:name — Update Role

```
PUT /api/auth/roles/manager
Authorization: Bearer <token>
Content-Type: application/json

{
  "label": "Senior Manager",
  "description": "Updated description"
}
```

### DELETE /api/auth/roles/:name — Delete Role

```
DELETE /api/auth/roles/manager
Authorization: Bearer <token>
```

Cannot delete the `admin` role.

---

## User ↔ Extension Linking

### POST /api/auth/users/:id/extensions/:extId — Link Extension

```
POST /api/auth/users/2/extensions/5
Authorization: Bearer <token>
```

### DELETE /api/auth/users/:id/extensions/:extId — Unlink Extension

```
DELETE /api/auth/users/2/extensions/5
Authorization: Bearer <token>
```

---

## User ↔ Device Linking

### POST /api/auth/users/:id/devices/:devId — Link Device

```
POST /api/auth/users/2/devices/3
Authorization: Bearer <token>
```

### DELETE /api/auth/users/:id/devices/:devId — Unlink Device

```
DELETE /api/auth/users/2/devices/3
Authorization: Bearer <token>
```
