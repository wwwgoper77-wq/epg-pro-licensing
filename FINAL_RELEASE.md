# EPG-PRO Licensing Server & Enigma2 Client - FINAL RELEASE NOTES

This release package contains the complete, production-ready implementation of the EPG-PRO translation licensing server and its corresponding Enigma2 Python 3 plugin client. All internal systems have been validated via automated integration testing and are prepared for immediate public deployment.

---

## 📋 Table of Contents
1. [Production Deployment Checklist](#-production-deployment-checklist)
2. [Server Environment Variables](#-server-environment-variables)
3. [Client Installation & Target Server Redirection](#-client-installation--target-server-redirection)
4. [Backup & Restore Procedures](#-backup--restore-procedures)
5. [Recovery Procedures](#-recovery-procedures)
6. [Troubleshooting & Diagnostics](#-troubleshooting--diagnostics)
7. [Validation Test Suite](#-validation-test-suite)

---

## 🚀 Production Deployment Checklist

Before taking the application live, ensure each of the following checklist items is satisfied:

- [ ] **Configure Admin Panel Credentials**: In your hosting provider's dashboard, set custom `ADMIN_USERNAME` and `ADMIN_PASSWORD` secrets.
- [ ] **Verify Port Binding**: Ensure your environment sets the `PORT` environment variable (defaults to `3000`).
- [ ] **Rebuild the Client Plugin**: If you change the cryptographic salt (`SIGNATURE_SECRET`), you must edit `arabic_epg_client/plugin.py` to match, and then re-run `python3 obfuscate.py` to pack the new release zip.
- [ ] **Mount Persistent Volumes**: Because the server uses a secure, light JSON database (`licenses.json`), mount a persistent disk volume to `/app` (or configure a custom `DB_PATH` pointing to your mounted disk directory, e.g., `/data/licenses.json`) to keep active licensing states intact when the hosting container restarts.
- [ ] **Define Server URL in Client Code**: Open `arabic_epg_client/plugin.py` and modify the `LICENSE_SERVER` variable to match your live production domain (e.g., `https://my-epg-licensing.up.railway.app`). Re-run `python3 obfuscate.py` before deploying!

---

## ⚙️ Server Environment Variables

The server accesses the following environment settings. Declare these inside your cloud container console (Railway, Render, or Google Cloud Run):

| Variable | Description | Production Recommended Value | Required |
| :--- | :--- | :--- | :--- |
| `PORT` | Inside container binding port. | `3000` (automatically injected by most hosts) | **Yes** |
| `APP_URL` | The public base URL of your deployed server. | `https://your-epg-pro-server.com` | **Yes** |
| `SIGNATURE_SECRET` | Cryptographic salt used for receiver signatures (Anti-Tampering). | Keep as default (`EPG_ARABIC_SECRET_2026`) or set a custom secure hash. | **Yes** |
| `ADMIN_USERNAME` | Web Panel Admin Login Username. | Choose a secure username. | **Yes** |
| `ADMIN_PASSWORD` | Web Panel Admin Login Password. | Choose a strong password. | **Yes** |
| `ADMIN_SESSION_SECRET` | Secret salt used for secure session cookie hashes. | Set a randomized string. | **Yes** |
| `DB_PATH` | Absolute or relative path to the licenses datastore. | `/data/licenses.json` (pointing to a persistent volume) | **Yes** |

---

## 📥 Client Installation & Target Server Redirection

### Step 1: Set Server URL
Open `arabic_epg_client/plugin.py` and locate line 38:
```python
LICENSE_SERVER = "http://your-deployed-server-url.com"  # Replace with your production domain!
```
Replace the placeholder with your actual secure HTTPS server URL (e.g. `https://my-licensing-api.com`).

### Step 2: Build client package
Run the compiler-obfuscator locally to pack your modified files into a production-ready package:
```bash
python3 obfuscate.py
```
This automatically updates `arabic_epg_protected.zip` which is served on your server's `/api/download/zip` endpoint.

### Step 3: Install on Receiver Box
To install the translator plugin on any Enigma2 box over the Internet:
1. Upload the files inside `arabic_epg_protected.zip` to the receiver box at: `/usr/lib/enigma2/python/Plugins/Extensions/ArabicEPGTranslator/`
2. Restart the GUI of the Enigma2 box.
3. Open the plugin screen, input a license key, and click **Green Button (Activate)**!

---

## 💾 Backup & Restore Procedures

### Automated Daily Backups (Recommended)
Since the server reads/writes to `licenses.json`, setting up a routine backup is extremely straightforward. If you use Railway or Render with a persistent storage mount, you can run a cron job to backup the file:
```bash
# Example backup shell command
cp /data/licenses.json /backups/licenses_$(date +%F_%H%M%S).json
```

### Manual Backup Checklist
1. Open your server terminal or connect via SFTP.
2. Download the `licenses.json` file.
3. Save it securely on your local storage.

### Restoring Database
1. In the event of a container wipe, redeploy the Docker container.
2. Upload your backed up `licenses.json` back to your persistent volume location.
3. Restart the server. The Express engine will instantly read and resume active licensing states!

---

## 🩹 Recovery Procedures

### What to do if the server domain changes?
If your server moves to a new domain name, Enigma2 clients will lose connection. To recover:
1. Update `LICENSE_SERVER` in `arabic_epg_client/plugin.py` to point to the new domain.
2. Re-run `python3 obfuscate.py` on your developer workspace.
3. Deploy the new server containing the updated `arabic_epg_protected.zip` archive.
4. Distribute the updated zip package to active clients. Clients can unzip and overwrite the files in their Enigma2 box without losing their local keys, as their local cache file `/etc/enigma2/arabic_epg.lic` remains preserved and holds the key! When they boot up, they will automatically check in against the new domain.

---

## 🩺 Troubleshooting & Diagnostics

| Symptoms | Root Cause | Immediate Action |
| :--- | :--- | :--- |
| **"Hardware Mismatch"** error on receiver | License is active, but the Hardware ID (HWID) bound to it does not match the active box. | Open the Admin Panel, locate the key, and click **Reset HWID** to unbind. |
| **"Tampering detected"** error on client | The local signature cache on the box is corrupt or does not match the secret salt. | Delete the local cache file: `/etc/enigma2/arabic_epg.lic` on the box and run activation again. Check that your server's `SIGNATURE_SECRET` matches the client's `SECRET_SALT` exactly. |
| **"License expired"** despite renewal | The receiver's clock is inaccurate or out of sync. | Sync the receiver box clock via NTP/Transponder streams and check in again. |
| Admin panel resets data on redeploy | Container storage is ephemeral and gets erased on restarts. | Configure a Persistent Disk Volume under your hosting control panel and point `DB_PATH` to it. |

---

## 🧪 Validation Test Suite

Our codebase features a standard integration suite `test_licensing.py`. You can execute these tests in any environment with Node.js and Python 3 installed:
```bash
# In your terminal
python3 test_licensing.py
```
This validates entire licensing lifecycles (generating, authenticating, mismatch traps, unbinding, revoking, and zip packaging) to ensure 100% compliance.
