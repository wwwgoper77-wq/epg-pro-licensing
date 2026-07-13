# EPG-PRO Commercial Licensing - FINAL RELEASE CHECKLIST

This document lists every step required to deploy, configure, run, and activate your EPG-PRO translation licensing system from a clean environment to the first live customer box.

---

## 📋 Table of Contents
1. [Phase 1: Environment & Secret Generation](#phase-1-environment--secret-generation)
2. [Phase 2: Compiling the Client Plugin Package](#phase-2-compiling-the-client-plugin-package)
3. [Phase 3: Deploying the Server Container](#phase-3-deploying-the-server-container)
4. [Phase 4: Verification of Deployed Services](#phase-4-verification-of-deployed-services)
5. [Phase 5: First Customer Key Generation](#phase-5-first-customer-key-generation)
6. [Phase 6: Client Installation & First Activation](#phase-6-client-installation--first-activation)

---

## 🔑 Phase 1: Environment & Secret Generation

To remove default values entirely, we will generate unique, secure cryptographic strings for our environment configuration.

### Step 1.1: Generate Cryptographic Salts
Run the following commands in your local shell to generate secure 64-character salts:
```bash
# Generate SIGNATURE_SECRET (Anti-Tamper receiver signature salt)
openssl rand -hex 32

# Generate ADMIN_SESSION_SECRET (Admin Dashboard session signing salt)
openssl rand -hex 32
```

### Step 1.2: Prepare the Production Environment Key-Values
Save the output strings. You will configure them on your hosting dashboard (or in `.env` if compiling locally):
- `SIGNATURE_SECRET`: *(The first hex string from Step 1.1)*
- `ADMIN_SESSION_SECRET`: *(The second hex string from Step 1.1)*
- `ADMIN_USERNAME`: *(Choose a custom, secure username, e.g. `epg_admin_prod`)*
- `ADMIN_PASSWORD`: *(Choose a strong, random password, e.g. `p@ssw0rd_Epg_2026!`)*
- `APP_URL`: *(Your public domain URL, e.g., `https://epg-licensing.yourdomain.com`)*
- `DB_PATH`: `/data/licenses.json` *(Confirming persistent volume directory)*
- `NODE_ENV`: `production`

---

## 🛠️ Phase 2: Compiling the Client Plugin Package

Our build system injects parameters directly from `.env` or system environment variables into the compiled client package. You never need to touch Python code files.

### Step 2.1: Write values into your workspace `.env`
Update your local `.env` with the production variables prepared in Phase 1:
```env
APP_URL=https://epg-licensing.yourdomain.com
SIGNATURE_SECRET=your_new_secure_64_character_signature_salt
```

### Step 2.2: Compile the Client Plugin Zip
Run the packer in your developer terminal:
```bash
python3 obfuscate.py
```
This script will:
1. Load `APP_URL` and `SIGNATURE_SECRET` from `.env`.
2. Inject them into `tmp/arabic_epg_build/plugin.py`.
3. Compress and obfuscate `plugin.py` and `translator.py`.
4. Pack them with standard scripts into `arabic_epg_protected.zip`.

---

## 📦 Phase 3: Deploying the Server Container

Deploy the full-stack server container onto your hosting provider.

### Step 3.1: Commit and Push Changes
Ensure your local `arabic_epg_protected.zip` is generated and committed to your repository before deploying.

### Step 3.2: Configure Persistent Disk Volume
- **Render / Railway**: Under settings, create a **Disk** or **Volume** of `1 GB` (which is more than enough for lifetime SQLite-style licensing states). Mount it to `/data`.
- **Set Environment Variable**: Configure `DB_PATH=/data/licenses.json`.

### Step 3.3: Set Environment Variables
Add your secure environment variables (from Phase 1) inside your host provider’s environment management settings (Railway / Render / Cloud Run dashboard).

### Step 3.4: Trigger Build & Deploy
Start deployment. The container will build using our multi-stage `Dockerfile` and serve your dashboard and client endpoints.

---

## 🔍 Phase 4: Verification of Deployed Services

Confirm that all endpoints are securely running on your live domain before distributing keys.

### Step 4.1: Confirm Static Assets & API Ingress
Navigate to your deployed URL:
`https://epg-licensing.yourdomain.com`
Verify that the login interface displays correctly.

### Step 4.2: Verify Production ZIP Downloads
Check that the `/api/download/zip` endpoint yields your correct production package by running this command or putting the URL in your browser:
```bash
curl -I https://epg-licensing.yourdomain.com/api/download/zip
```
Ensure it returns a `200 OK` status with `Content-Type: application/zip`.

---

## 🎫 Phase 5: First Customer Key Generation

Access your administrative panel to issue the first license key.

### Step 5.1: Login to Admin Panel
1. Open `https://epg-licensing.yourdomain.com`
2. Input your `ADMIN_USERNAME` and `ADMIN_PASSWORD` (configured in Phase 1).

### Step 5.2: Create a License Key
1. In the **Generate License Keys** panel, select a subscription type (e.g. `Lifetime` or `30 Days`).
2. Input an optional client note (e.g., `"Ahmed - VU+ Uno Box"`).
3. Set Quantity = `1`.
4. Click **Generate Keys**.
5. Copy the newly generated key (format: `EPG-PRO-XXXX-XXXX-XXXX`).

---

## 🔌 Phase 6: Client Installation & First Activation

Deliver the client package to your customer and activate their Enigma2 box.

### Step 6.1: Extract and Upload Plugin
1. Download the production zip archive from your server: `https://epg-licensing.yourdomain.com/api/download/zip`
2. Extract the `ArabicEPGTranslator` folder inside the zip.
3. Upload the entire `ArabicEPGTranslator` folder to the customer's box over FTP/SFTP at:
   `/usr/lib/enigma2/python/Plugins/Extensions/ArabicEPGTranslator/`
4. Set execution permissions on the install script:
   ```bash
   chmod 755 /usr/lib/enigma2/python/Plugins/Extensions/ArabicEPGTranslator/install.sh
   ```

### Step 6.2: Install & Boot Plugin
Run the installation script inside the box's terminal:
```bash
sh /usr/lib/enigma2/python/Plugins/Extensions/ArabicEPGTranslator/install.sh
```
Restart the Enigma2 box GUI to load the extension.

### Step 6.3: Perform Activation Check
1. On the Enigma2 receiver screen, open the EPG Arabic Translator extension.
2. Enter the customer's copied License Key (from Phase 5).
3. Click the **Green Button** on the remote control to trigger activation.
4. The client will securely connect, bind to the box's Hardware ID (HWID), verify the cryptographically signed response, and activate!

### Step 6.4: Monitor Server Logs
In your server's Admin Panel dashboard, inspect the live log stream. You will see an immediate, real-time entry:
- **Action**: `activate_success`
- **Key**: `EPG-PRO-XXXX-XXXX-XXXX`
- **Receiver**: `OPENATV (VU+ UNO 4K SE)`
- **IP Address**: *(The customer's live public IP)*

**The licensing pipeline is now fully deployed, verified, and operational!**
