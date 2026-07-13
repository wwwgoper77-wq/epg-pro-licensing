# EPG-PRO Licensing Server - API Documentation

This document describes the external API endpoints exposed by the EPG-PRO Licensing Server. These endpoints are called by Enigma2 client receivers (using Python 3) and web clients to manage license activations.

---

## 🔑 Licensing Endpoints

### 1. License Activation (`/api/license/activate`)
Performs remote online activation or subsequent verification of an Enigma2 receiver binding a license key to a Hardware ID (HWID).

- **Method**: `POST` or `GET`
- **Content-Type**: `application/json` (if POST) or query parameters (if GET)

#### Request Parameters:
| Name | Type | Location | Description | Required |
| :--- | :--- | :--- | :--- | :--- |
| `key` | String | Query / Body | The EPG-PRO license key (e.g. `EPG-PRO-XXXX-XXXX-XXXX`) | **Yes** |
| `hwid` | String | Query / Body | Hardware fingerprint of the box (hex string) | **Yes** |
| `image` | String | Query / Body | The active Enigma2 firmware image (e.g. `OPENATV`) | No |
| `model` | String | Query / Body | Enigma2 receiver model (e.g. `VU+ UNO 4K SE`) | No |

---

#### Successful Response (`200 OK`):
Returned when the key exists, is valid, is not revoked, and is either unbound or matches the current receiver's HWID.

```json
{
  "success": true,
  "status": "Activated",
  "key": "EPG-PRO-LIFETIME",
  "hwid": "MYHWID123456",
  "expires_at": "lifetime",
  "activated_at": "2026-07-13T09:02:05.763Z",
  "server_time": "2026-07-13T09:02:05.763Z",
  "signature": "20db6e1f5d6c900c019a2065c31a5d6a05a7b34151e5cbf96d104c3bd54da431",
  "message": "Enigma2 plugin activated successfully!"
}
```

> **Note on Signature**: The `signature` is generated server-side using SHA256 of `${key}:${hwid}:${expires_at}:${SIGNATURE_SECRET}`. The Python client verifies this signature locally to prevent man-in-the-middle attacks or proxy tampering.

---

#### Error Responses:

- **Missing Parameters (`400 Bad Request`)**:
  ```json
  {
    "success": false,
    "error": "License Key and Hardware ID (HWID) are required."
  }
  ```

- **Invalid License Key (`404 Not Found`)**:
  ```json
  {
    "success": false,
    "error": "License Key not found. Please verify your purchase."
  }
  ```

- **Hardware Binding Lock (`400 Bad Request`)**:
  Occurs when the license is active, but is bound to a different Enigma2 box.
  ```json
  {
    "success": false,
    "error": "Hardware Mismatch. License key is locked to another Enigma2 receiver."
  }
  ```

- **Revoked License (`403 Forbidden`)**:
  Occurs when an administrator has banned or disabled the key from the dashboard.
  ```json
  {
    "success": false,
    "error": "This license key has been remotely revoked by administrator."
  }
  ```

---

### 2. License Verification Only (`/api/license/verify`)
A lightweight, fast check called periodically by the core translator module (`translator.py`) to confirm licensing authenticity without altering activation logs or updating device settings.

- **Method**: `POST` or `GET`
- **Content-Type**: `application/json` (if POST) or query parameters (if GET)

#### Request Parameters:
- `key` (String, Required)
- `hwid` (String, Required)

#### Successful Response (`200 OK`):
```json
{
  "success": true,
  "status": "Activated",
  "key": "EPG-PRO-LIFETIME",
  "hwid": "MYHWID123456",
  "expires_at": "lifetime",
  "signature": "20db6e1f5d6c900c019a2065c31a5d6a05a7b34151e5cbf96d104c3bd54da431"
}
```

#### Error Responses:
- Key not found (`404`): `{"success": false, "error": "License not found."}`
- Revoked (`403`): `{"success": false, "error": "License is revoked."}`
- HWID mismatch (`400`): `{"success": false, "error": "HWID mismatch."}`
- Expired (`403`): `{"success": false, "error": "License expired."}`

---

## 📦 Client Download Endpoints

### 1. Download Production Plugin Archive (`/api/download/zip`)
Downloads the obfuscated, production-ready Python 3 client installer files inside a single `.zip` archive.

- **Method**: `GET`
- **Response Headers**:
  - `Content-Disposition: attachment; filename="arabic_epg_protected.zip"`
  - `Content-Type: application/zip`

---

### 2. Download Raw Template Files (`/api/download/raw/:filename`)
Allows administrators or support teams to download specific file structures directly.

- **Method**: `GET`
- **Filename Options**: `__init__.py`, `plugin.py`, `translator.py`, `install.sh`, `uninstall.sh`
- **Response Headers**:
  - `Content-Type: text/plain`
