# Directory Service

Two-layer architecture:

1. **`/api/services/directory/*`** — JSON API (data source, runs on API port 8000)
2. **`/services/directory/*`** — XML for Cisco phones (standalone server, port 8001)

## Architecture

```
Cisco IP Phone  ──HTTP──>  /services/directory/*  (port 8001, XML)
                              │
                              └── calls ──>  /api/services/directory/*  (port 8000, JSON)
                                                 │
                                                 ├── personal_directory table
                                                 ├── users.services_pin
                                                 └── FreePBX API (corporate)
```

## Config Settings

| Key | Default | Description |
|-----|---------|-------------|
| `directory.enabled` | `true` | Master switch for entire directory service |
| `directory.personal_enabled` | `true` | Show personal directory in menu |
| `directory.personal_label` | `Personal Directory` | Display name on phone menu |
| `directory.corporate_enabled` | `true` | Show corporate directory in menu |
| `directory.corporate_label` | `Corporate Directory` | Display name on phone menu |
| `directory.port` | `8001` | XML server listen port |

Disable any service and it disappears from the menu. Phones get an XML "service disabled" message if they try to access it directly.

---

## API Layer — `/api/services/directory/*` (JSON)

These endpoints are the data source. Auth is via `username` + `services_pin` (not JWT).

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/services/directory/menu` | Enabled services config |
| `GET` | `/api/services/directory/personal?username=X&pin=Y` | User's contacts |
| `POST` | `/api/services/directory/personal/contact` | Add/edit/delete/reorder contact |
| `GET` | `/api/services/directory/personal/security?username=X&pin=Y` | PIN status |
| `POST` | `/api/services/directory/personal/pin` | Set/disable PIN |
| `GET` | `/api/services/directory/corporate?firstname=X&lastname=Y&number=Z` | Corporate search |

### POST /api/services/directory/personal/contact

**Body:**
```json
{
  "username": "jdoe",
  "pin": "1234",
  "action": "add",
  "name": "John Doe",
  "number": "5678"
}
```

Actions: `add`, `edit`, `delete`, `reorder`
- `edit`/`delete`/`reorder` require `idx` (0-based index)
- `reorder` also requires `newIdx`

---

## XML Layer — `/services/directory/*` (CiscoIPPhone XML)

Standalone server on port 8001. Serves `text/xml` responses that Cisco phones render natively.

### Main Menu

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/services/directory/` | Top-level menu (Personal + Corporate) |

### Personal Directory

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/services/directory/personal` | Login form or contacts (if authed) |
| `GET` | `/services/directory/personal/add?username=X&pin=Y` | Add contact form |
| `GET` | `/services/directory/personal/add_contact` | Save new contact |
| `GET` | `/services/directory/personal/select_edit?username=X&pin=Y` | Pick contact to edit |
| `GET` | `/services/directory/personal/edit_form?username=X&pin=Y&idx=0` | Edit form |
| `GET` | `/services/directory/personal/update_contact` | Save edit |
| `GET` | `/services/directory/personal/select_delete?username=X&pin=Y` | Pick contact to delete |
| `GET` | `/services/directory/personal/delete_contact` | Delete contact |
| `GET` | `/services/directory/personal/reorder_menu?username=X&pin=Y` | Pick contact to move |
| `GET` | `/services/directory/personal/reorder_select?username=X&pin=Y&idx=0` | Pick position |
| `GET` | `/services/directory/personal/reorder_move?username=X&pin=Y&idx=0&newIdx=1` | Move contact |
| `GET` | `/services/directory/personal/security_menu?username=X&pin=Y` | PIN management |
| `GET` | `/services/directory/personal/pin_change_form?username=X&pin=Y` | Set/change PIN |
| `GET` | `/services/directory/personal/pin_change_submit` | Save new PIN |
| `GET` | `/services/directory/personal/pin_disable_form?username=X&pin=Y` | Confirm to disable |
| `GET` | `/services/directory/personal/pin_disable_submit` | Disable PIN |

### Corporate Directory

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/services/directory/corporate` | Search form or results |

## Auth Flow (Personal Directory)

1. Phone hits `/services/directory/personal` with no params
2. Server shows `CiscoIPPhoneInput` form asking for username + PIN
3. Phone submits → server calls API `/api/services/directory/personal?username=X&pin=Y`
4. API validates against `users.services_pin`
5. If valid → returns contacts as JSON → XML service wraps in `CiscoIPPhoneDirectory`
6. If invalid → returns 401 → XML service shows `CiscoIPPhoneText` "Authentication Failed"

## XML Response Types

### CiscoIPPhoneDirectory — Contact Listing
```xml
<?xml version="1.0" encoding="utf-8"?>
<CiscoIPPhoneDirectory>
  <Title>Personal Directory</Title>
  <Prompt>Records 1 to 3 of 3</Prompt>
  <DirectoryEntry>
    <Name>John Doe</Name>
    <Telephone>1234</Telephone>
  </DirectoryEntry>
  <SoftKeyItem>
    <Name>Dial</Name>
    <URL>SoftKey:Dial</URL>
    <Position>1</Position>
  </SoftKeyItem>
  <SoftKeyItem>
    <Name>Exit</Name>
    <URL>SoftKey:Exit</URL>
    <Position>2</Position>
  </SoftKeyItem>
</CiscoIPPhoneDirectory>
```

### CiscoIPPhoneMenu — Navigation
```xml
<?xml version="1.0" encoding="utf-8"?>
<CiscoIPPhoneMenu>
  <Title>Directory</Title>
  <Prompt>Select a service</Prompt>
  <MenuItem>
    <Name>Personal Directory</Name>
    <URL>http://server:8001/services/directory/personal</URL>
  </MenuItem>
  <MenuItem>
    <Name>Corporate Directory</Name>
    <URL>http://server:8001/services/directory/corporate</URL>
  </MenuItem>
</CiscoIPPhoneMenu>
```

### CiscoIPPhoneInput — Forms
```xml
<?xml version="1.0" encoding="utf-8"?>
<CiscoIPPhoneInput>
  <Title>Personal Directory</Title>
  <Prompt>Enter your username and PIN</Prompt>
  <InputItem>
    <DisplayName>Username</DisplayName>
    <QueryStringParam>username</QueryStringParam>
    <InputFlags>A</InputFlags>
    <DefaultValue></DefaultValue>
  </InputItem>
  <InputItem>
    <DisplayName>PIN</DisplayName>
    <QueryStringParam>pin</QueryStringParam>
    <InputFlags>T</InputFlags>
    <DefaultValue></DefaultValue>
  </InputItem>
  <URL>http://server:8001/services/directory/personal</URL>
  <SoftKeyItem>
    <Name>Submit</Name>
    <URL>SoftKey:Submit</URL>
    <Position>1</Position>
  </SoftKeyItem>
</CiscoIPPhoneInput>
```

### CiscoIPPhoneText — Messages
```xml
<?xml version="1.0" encoding="utf-8"?>
<CiscoIPPhoneText>
  <Title>Authentication Failed</Title>
  <Text>Invalid username or PIN.</Text>
  <SoftKeyItem>
    <Name>Retry</Name>
    <URL>http://server:8001/services/directory/personal</URL>
    <Position>1</Position>
  </SoftKeyItem>
</CiscoIPPhoneText>
```

### CiscoIPPhoneExecute — Status + Redirect
```xml
<?xml version="1.0" encoding="utf-8"?>
<CiscoIPPhoneExecute>
  <ExecuteItem Priority="0" URL="Status:Contact John Doe added"/>
  <ExecuteItem Priority="0" URL="http://server:8001/services/directory/personal?username=jdoe&pin=1234"/>
</CiscoIPPhoneExecute>
```

## InputFlags

| Flag | Meaning |
|------|---------|
| `A` | Alphabetic (text input) |
| `T` | Telephone (numeric only) |

## Running the XML Server

```bash
# API must be running first on port 8000
npm start          # or: node api/src/app.js

# Then start the directory XML server
node services/directory.js
```

The XML server auto-detects the API at `http://127.0.0.1:8000`. Override with `NEXUS_API_PORT` env var.
