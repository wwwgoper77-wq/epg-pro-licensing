# EPG-PRO Licensing Server - Administrator & Panel Guide

This guide explains how to administer the EPG-PRO Licensing Server, manage license keys, reset receiver hardware bindings, and inspect live log streams.

---

## 🔐 Logging In to the Dashboard

1. **Access the Dashboard**:
   Open a browser and navigate to the root URL of your deployed server (e.g. `https://your-server-domain.com`).
2. **Enter Credentials**:
   - **Default Username**: `admin`
   - **Default Password**: `admin`
3. **Change Defaults**:
   To secure your panel, update the environment variables `ADMIN_USERNAME` and `ADMIN_PASSWORD` in your hosting console (Railway, Render, or Google Cloud).

---

## 🛠️ Key Administrative Actions

The React/Vite dashboard features intuitive, dedicated buttons for managing every aspect of the license database:

### 1. Generating New License Keys
You can generate unique keys in batches. Each generated key follows the secure, human-readable format: `EPG-PRO-XXXX-XXXX-XXXX` (using random uppercase hex pairs).

- **Subscription Types**:
  - **7 Days**: Great for short-term trials. Countdown begins only when activated on a receiver.
  - **30 Days**: Standard monthly subscription.
  - **90 Days**: Quarterly tier.
  - **Lifetime**: Full, permanent license.
- **Batches**: Enter a quantity from 1 to 50 to generate multiple license keys in a single click.
- **Admin Notes**: Add notes (e.g., *"Customer: Ahmed - Reseller Tier 1"*) to keep track of sales channels.

### 2. Resetting / Unbinding Hardware IDs (HWID)
Enigma2 receivers bind to a stable fingerprint of the receiver's motherboard and network card. If a customer upgrades their Enigma2 receiver box, their existing license will throw a "Hardware Mismatch" error.

- **Action**: Locate the customer's key in the license table, and click **Reset HWID** (or **Unbind**).
- **Result**: The server clears the bound `hwid`, sets the status to `Inactive`, and resets the expiry trigger (for non-lifetime subscriptions). The key is immediately ready to be bound to the customer's new box!

### 3. Revoking / Banning a License
If a customer disputes a payment or a key is leaked or shared unauthorized, you can instantly revoke it.

- **Action**: Click the **Revoke** button next to the target key.
- **Result**: The status turns to `Revoked`. If the receiver attempts to query translation services, the client plugin will block further lookups and print a notice: *"This license has been remotely revoked by administrator."*

### 4. Reactivating / Re-enabling a Key
If a revoked key needs to be reinstated, you can undo the revocation.

- **Action**: Click the **Enable** button next to the revoked key.
- **Result**: The status reverts to either `Active` (if a receiver is already bound) or `Inactive` (ready for its first binding).

### 5. Permanent Deletion
To completely remove a license key from the database and keep listings clean:

- **Action**: Click **Delete** on the license card or row.
- **Result**: The key is completely purged from `licenses.json`.

---

## 📝 Understanding the Activation Log Stream

The dashboard includes a real-time log terminal that captures client network activities:

- **Action Tags**:
  - `activate_success`: A receiver bound and activated an inactive key.
  - `verify_success`: An active client successfully checked in.
  - `failed_invalid_key`: Someone entered an incorrect key.
  - `failed_hwid_mismatch`: An active key was tried on a box with a different HWID.
  - `failed_revoked`: A banned receiver tried to run EPG translations.
- **Metadata Captured**: Each log line captures the precise timestamp, the license key, the receiver model/firmware image (e.g., `OPENATV (VU+ UNO 4K SE)`), and the remote client IP.
- **Clearing Logs**: Click **Clear Logs** on the top right of the logs panel to wipe the logs list clean.
