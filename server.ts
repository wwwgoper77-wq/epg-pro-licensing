import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "licenses.json");
const SIGNATURE_SECRET = process.env.SIGNATURE_SECRET || "EPG_ARABIC_SECRET_2026"; // Match with Python plugin signature verification

// Simple admin credentials
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin"; // Can be customized
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "EPG_SESSION_2026";

// Production Security Guard: Enforce non-default credentials and environment variables in production
if (process.env.NODE_ENV === "production") {
  if (!process.env.ADMIN_USERNAME || process.env.ADMIN_USERNAME === "admin") {
    console.error("❌ CRITICAL ERROR: ADMIN_USERNAME environment variable must be set in production and cannot be the default 'admin'!");
    process.exit(1);
  }
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === "admin") {
    console.error("❌ CRITICAL ERROR: ADMIN_PASSWORD environment variable must be set in production and cannot be the default 'admin'!");
    process.exit(1);
  }
  if (!process.env.SIGNATURE_SECRET || process.env.SIGNATURE_SECRET === "EPG_ARABIC_SECRET_2026" || process.env.SIGNATURE_SECRET.length < 16) {
    console.error("❌ CRITICAL ERROR: SIGNATURE_SECRET environment variable must be set in production with a secure unique key of at least 16 characters!");
    process.exit(1);
  }
  if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET === "EPG_SESSION_2026" || process.env.ADMIN_SESSION_SECRET.length < 16) {
    console.error("❌ CRITICAL ERROR: ADMIN_SESSION_SECRET environment variable must be set in production with a secure unique key of at least 16 characters!");
    process.exit(1);
  }
}

const app = express();
app.use(express.json());

// Helper to read database
function readDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error reading licenses.json:", e);
  }
  return { licenses: [], activation_logs: [] };
}

// Helper to write database
function writeDB(data: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing licenses.json:", e);
  }
}

// Generate signature for license state to prevent tamper
function generateSignature(key: string, hwid: string, expiresAt: string) {
  const rawSignature = `${key}:${hwid}:${expiresAt}:${SIGNATURE_SECRET}`;
  return crypto.createHash("sha256").update(rawSignature).digest("hex");
}

// --- API Endpoints for Enigma2 Plugin ---

// Online Activation / Verification Endpoint (Accepts POST or GET)
app.all("/api/license/activate", (req, res) => {
  const method = req.method;
  const params = method === "POST" ? req.body : req.query;
  
  const key = (params.key || "").toString().trim();
  const hwid = (params.hwid || "").toString().trim();
  const image = (params.image || "Unknown Image").toString().trim();
  const receiverModel = (params.model || "Unknown Receiver").toString().trim();
  
  if (!key || !hwid) {
    return res.status(400).json({
      success: false,
      error: "License Key and Hardware ID (HWID) are required."
    });
  }

  const db = readDB();
  const licenseIndex = db.licenses.findIndex((l: any) => l.key.toUpperCase() === key.toUpperCase());

  if (licenseIndex === -1) {
    // Log failed activation attempt
    const newLog = {
      id: crypto.randomUUID(),
      key,
      hwid,
      image: `${image} (${receiverModel})`,
      action: "failed_invalid_key",
      timestamp: new Date().toISOString(),
      ip: req.ip || req.headers["x-forwarded-for"] || "unknown"
    };
    db.activation_logs.unshift(newLog);
    writeDB(db);

    return res.status(404).json({
      success: false,
      error: "License Key not found. Please verify your purchase."
    });
  }

  const license = db.licenses[licenseIndex];

  // Check if revoked
  if (license.status === "Revoked") {
    const newLog = {
      id: crypto.randomUUID(),
      key,
      hwid,
      image: `${image} (${receiverModel})`,
      action: "failed_revoked",
      timestamp: new Date().toISOString(),
      ip: req.ip || req.headers["x-forwarded-for"] || "unknown"
    };
    db.activation_logs.unshift(newLog);
    writeDB(db);

    return res.status(403).json({
      success: false,
      error: "This license key has been remotely revoked by administrator."
    });
  }

  // Check expiry if already expired
  if (license.status === "Expired") {
    return res.status(403).json({
      success: false,
      error: "This license has expired."
    });
  }

  const now = new Date();

  // Check if expires_at exists and is a date, and is past now
  if (license.expires_at && license.expires_at !== "lifetime") {
    const expiryDate = new Date(license.expires_at);
    if (expiryDate < now) {
      license.status = "Expired";
      
      const newLog = {
        id: crypto.randomUUID(),
        key,
        hwid,
        image: `${image} (${receiverModel})`,
        action: "expired",
        timestamp: now.toISOString(),
        ip: req.ip || req.headers["x-forwarded-for"] || "unknown"
      };
      db.activation_logs.unshift(newLog);
      writeDB(db);

      return res.status(403).json({
        success: false,
        error: "This license has expired."
      });
    }
  }

  // Binding logic: Check HWID mismatch
  if (license.hwid && license.hwid !== hwid) {
    const newLog = {
      id: crypto.randomUUID(),
      key,
      hwid,
      image: `${image} (${receiverModel})`,
      action: "failed_hwid_mismatch",
      timestamp: now.toISOString(),
      ip: req.ip || req.headers["x-forwarded-for"] || "unknown"
    };
    db.activation_logs.unshift(newLog);
    writeDB(db);

    return res.status(400).json({
      success: false,
      error: "Hardware Mismatch. License key is locked to another Enigma2 receiver."
    });
  }

  // Perform activation if not yet bound
  let isNewActivation = false;
  if (!license.hwid) {
    license.hwid = hwid;
    license.status = "Active";
    license.activated_at = now.toISOString();
    
    // Set expiry based on type if not set yet
    if (license.type === "7days") {
      const exp = new Date();
      exp.setDate(exp.getDate() + 7);
      license.expires_at = exp.toISOString();
    } else if (license.type === "30days") {
      const exp = new Date();
      exp.setDate(exp.getDate() + 30);
      license.expires_at = exp.toISOString();
    } else if (license.type === "90days") {
      const exp = new Date();
      exp.setDate(exp.getDate() + 90);
      license.expires_at = exp.toISOString();
    } else {
      license.expires_at = "lifetime";
    }
    isNewActivation = true;
  }

  license.last_checked = now.toISOString();
  
  // Calculate expiry value for Python response
  const expiryValue = license.expires_at;

  // Generate tamper-proof cryptographic signature
  const signature = generateSignature(key, hwid, expiryValue);

  const logAction = isNewActivation ? "activate_success" : "verify_success";
  const newLog = {
    id: crypto.randomUUID(),
    key,
    hwid,
    image: `${image} (${receiverModel})`,
    action: logAction,
    timestamp: now.toISOString(),
    ip: req.ip || req.headers["x-forwarded-for"] || "unknown"
  };

  db.activation_logs.unshift(newLog);
  writeDB(db);

  return res.json({
    success: true,
    status: "Activated",
    key: license.key,
    hwid: license.hwid,
    expires_at: expiryValue,
    activated_at: license.activated_at,
    server_time: now.toISOString(),
    signature: signature,
    message: isNewActivation 
      ? "Enigma2 plugin activated successfully!" 
      : "License verified successfully."
  });
});

// Verification Only Endpoint (Accepts POST or GET)
app.all("/api/license/verify", (req, res) => {
  const method = req.method;
  const params = method === "POST" ? req.body : req.query;
  
  const key = (params.key || "").toString().trim();
  const hwid = (params.hwid || "").toString().trim();

  if (!key || !hwid) {
    return res.status(400).json({
      success: false,
      error: "License Key and HWID are required."
    });
  }

  const db = readDB();
  const license = db.licenses.find((l: any) => l.key.toUpperCase() === key.toUpperCase());

  if (!license) {
    return res.status(404).json({ success: false, error: "License not found." });
  }

  if (license.status === "Revoked") {
    return res.status(403).json({ success: false, error: "License is revoked." });
  }

  if (license.hwid && license.hwid !== hwid) {
    return res.status(400).json({ success: false, error: "HWID mismatch." });
  }

  const now = new Date();
  if (license.expires_at && license.expires_at !== "lifetime") {
    const expiryDate = new Date(license.expires_at);
    if (expiryDate < now) {
      license.status = "Expired";
      writeDB(db);
      return res.status(403).json({ success: false, error: "License expired." });
    }
  }

  const signature = generateSignature(key, hwid, license.expires_at);

  return res.json({
    success: true,
    status: "Activated",
    key: license.key,
    hwid: license.hwid || hwid,
    expires_at: license.expires_at,
    signature: signature
  });
});


// --- ADMIN DASHBOARD API (Requires Login/Auth Token checking for security) ---

// Basic admin login
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = crypto.createHash("sha256").update(`${username}:${password}:${ADMIN_SESSION_SECRET}`).digest("hex");
    return res.json({
      success: true,
      token,
      admin: { username }
    });
  }
  return res.status(401).json({
    success: false,
    error: "Invalid administrator credentials."
  });
});

// Middleware to protect admin routes
function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const expectedToken = crypto.createHash("sha256").update(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}:${ADMIN_SESSION_SECRET}`).digest("hex");
  
  if (authHeader && authHeader === `Bearer ${expectedToken}`) {
    next();
  } else {
    res.status(401).json({ success: false, error: "Unauthorized access to licensing panel." });
  }
}

// Get all licenses and logs
app.get("/api/admin/data", adminAuth, (req, res) => {
  res.json(readDB());
});

// Create/Generate license keys
app.post("/api/admin/licenses", adminAuth, (req, res) => {
  const { type, notes, count } = req.body;
  if (!type) {
    return res.status(400).json({ success: false, error: "License subscription type is required." });
  }

  const db = readDB();
  const createdKeys: any[] = [];
  const loopCount = count && count > 0 && count <= 50 ? count : 1;

  for (let i = 0; i < loopCount; i++) {
    // Generate beautiful key: EPG-PRO-XXXX-XXXX-XXXX
    const randHex = () => crypto.randomBytes(2).toString("hex").toUpperCase();
    const generatedKey = `EPG-PRO-${randHex()}-${randHex()}-${randHex()}`;
    
    const newLicense = {
      key: generatedKey,
      type,
      hwid: null,
      status: "Inactive",
      created_at: new Date().toISOString(),
      activated_at: null,
      expires_at: type === "lifetime" ? "lifetime" : null,
      last_checked: null,
      notes: notes || `Admin Generated Key (${type})`
    };

    db.licenses.unshift(newLicense);
    createdKeys.push(newLicense);
  }

  writeDB(db);
  res.json({
    success: true,
    message: `Generated ${loopCount} license key(s) successfully.`,
    keys: createdKeys
  });
});

// Revoke/Disable license
app.post("/api/admin/licenses/revoke", adminAuth, (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ success: false, error: "Key is required." });
  }

  const db = readDB();
  const license = db.licenses.find((l: any) => l.key.toUpperCase() === key.toUpperCase());

  if (!license) {
    return res.status(404).json({ success: false, error: "License not found." });
  }

  license.status = "Revoked";
  
  const log = {
    id: crypto.randomUUID(),
    key: license.key,
    hwid: license.hwid || "N/A",
    image: "Web Admin Dashboard",
    action: "admin_revoked",
    timestamp: new Date().toISOString(),
    ip: req.ip || "127.0.0.1"
  };
  db.activation_logs.unshift(log);

  writeDB(db);
  res.json({ success: true, message: `License ${key} has been revoked successfully.` });
});

// Enable License (re-activate)
app.post("/api/admin/licenses/enable", adminAuth, (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ success: false, error: "Key is required." });
  }

  const db = readDB();
  const license = db.licenses.find((l: any) => l.key.toUpperCase() === key.toUpperCase());

  if (!license) {
    return res.status(404).json({ success: false, error: "License not found." });
  }

  license.status = license.hwid ? "Active" : "Inactive";
  
  const log = {
    id: crypto.randomUUID(),
    key: license.key,
    hwid: license.hwid || "N/A",
    image: "Web Admin Dashboard",
    action: "admin_enabled",
    timestamp: new Date().toISOString(),
    ip: req.ip || "127.0.0.1"
  };
  db.activation_logs.unshift(log);

  writeDB(db);
  res.json({ success: true, message: `License ${key} enabled successfully.`, status: license.status });
});

// Reset/Unbind HWID
app.post("/api/admin/licenses/reset", adminAuth, (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ success: false, error: "Key is required." });
  }

  const db = readDB();
  const license = db.licenses.find((l: any) => l.key.toUpperCase() === key.toUpperCase());

  if (!license) {
    return res.status(404).json({ success: false, error: "License not found." });
  }

  const oldHwid = license.hwid;
  license.hwid = null;
  license.status = "Inactive";
  license.activated_at = null;
  // If it's not lifetime, we clear the expires_at so it sets 7/30/90 days from the next activation
  if (license.type !== "lifetime") {
    license.expires_at = null;
  }

  const log = {
    id: crypto.randomUUID(),
    key: license.key,
    hwid: oldHwid || "N/A",
    image: "Web Admin Dashboard",
    action: "admin_hwid_reset",
    timestamp: new Date().toISOString(),
    ip: req.ip || "127.0.0.1"
  };
  db.activation_logs.unshift(log);

  writeDB(db);
  res.json({ success: true, message: `Hardware ID reset successfully for license ${key}. Ready for a new receiver.` });
});

// Delete license permanently
app.post("/api/admin/licenses/delete", adminAuth, (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ success: false, error: "Key is required." });
  }

  const db = readDB();
  const initialCount = db.licenses.length;
  db.licenses = db.licenses.filter((l: any) => l.key.toUpperCase() !== key.toUpperCase());

  if (db.licenses.length === initialCount) {
    return res.status(404).json({ success: false, error: "License not found." });
  }

  const log = {
    id: crypto.randomUUID(),
    key: key,
    hwid: "N/A",
    image: "Web Admin Dashboard",
    action: "admin_deleted",
    timestamp: new Date().toISOString(),
    ip: req.ip || "127.0.0.1"
  };
  db.activation_logs.unshift(log);

  writeDB(db);
  res.json({ success: true, message: `License ${key} has been permanently deleted from server.` });
});

// Clear all logs
app.post("/api/admin/logs/clear", adminAuth, (req, res) => {
  const db = readDB();
  db.activation_logs = [];
  writeDB(db);
  res.json({ success: true, message: "Activation logs cleared successfully." });
});

// --- DOWNLOAD ENDPOINTS FOR CLIENT DEPLOYMENT ---

app.get("/api/download/zip", (req, res) => {
  const zipPath = path.join(process.cwd(), "arabic_epg_protected.zip");
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, "arabic_epg_protected.zip");
  } else {
    res.status(404).json({ success: false, error: "Production ZIP not generated yet. Please contact support." });
  }
});

app.get("/api/download/raw/:filename", (req, res) => {
  const filename = req.params.filename;
  const safeFiles = ["__init__.py", "plugin.py", "translator.py", "install.sh", "uninstall.sh"];
  if (!safeFiles.includes(filename)) {
    return res.status(400).json({ success: false, error: "Invalid file request." });
  }
  const filePath = path.join(process.cwd(), "arabic_epg_client", filename);
  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "text/plain");
    res.sendFile(filePath);
  } else {
    res.status(404).json({ success: false, error: "Source file not found." });
  }
});

// --- Start/Serve Web Interface with Vite Middleware in Development ---

async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  // In production, Node/Vite packages might not be fully installed. We detect production based on environment or absence of Vite.
  const isProd = process.env.NODE_ENV === "production" || !fs.existsSync(path.join(process.cwd(), "node_modules", "vite"));

  if (!isProd) {
    console.log("Starting server in development mode with Vite middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log(`Starting server in production mode serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
