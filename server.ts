import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;
const SIGNATURE_SECRET = "arabic_epg_translator_pro_secret_key";

// Paths for persistent JSON databases
const DATA_DIR = path.join(process.cwd(), "data");
const LICENSES_FILE = path.join(DATA_DIR, "licenses.json");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface License {
  key: string;
  tier: "Free" | "Premium" | "Ultimate";
  maxDevices: number;
  activatedDevices: string[];
  expiresAt: string; // YYYY-MM-DD
  active: boolean;
  createdAt: string;
}

interface ActivationLog {
  timestamp: string;
  key: string;
  hwid: string;
  action: string;
  status: string;
  ip: string;
}

// Seed helper
function loadLicenses(): License[] {
  if (!fs.existsSync(LICENSES_FILE)) {
    const defaultLicenses: License[] = [
      {
        key: "EPG-PRO-GOLD-MEMBER",
        tier: "Ultimate",
        maxDevices: 10,
        activatedDevices: ["F57106190332A037"],
        expiresAt: "2030-12-31",
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        key: "EPGPRO-DEMO-STAN-8721-9923",
        tier: "Ultimate",
        maxDevices: 10,
        activatedDevices: ["F57106190332A037"],
        expiresAt: "2030-12-31",
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        key: "EPG-PRO-DEMO-STAN-8721-9923",
        tier: "Ultimate",
        maxDevices: 10,
        activatedDevices: ["F57106190332A037"],
        expiresAt: "2030-12-31",
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        key: "EPGPRO-DEMO-STAN",
        tier: "Ultimate",
        maxDevices: 10,
        activatedDevices: ["F57106190332A037"],
        expiresAt: "2030-12-31",
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        key: "EPG-PRO-DEMO-STAN",
        tier: "Ultimate",
        maxDevices: 10,
        activatedDevices: ["F57106190332A037"],
        expiresAt: "2030-12-31",
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        key: "EPG-PRO-COMMERCIAL",
        tier: "Premium",
        maxDevices: 3,
        activatedDevices: ["F57106190332A037"],
        expiresAt: "2028-06-30",
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        key: "EPG-PRO-TRIAL-KEY",
        tier: "Premium",
        maxDevices: 1,
        activatedDevices: ["F57106190332A037"],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        active: true,
        createdAt: new Date().toISOString(),
      }
    ];
    fs.writeFileSync(LICENSES_FILE, JSON.stringify(defaultLicenses, null, 2), "utf-8");
    return defaultLicenses;
  }
  try {
    return JSON.parse(fs.readFileSync(LICENSES_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}

function saveLicenses(licenses: License[]) {
  fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2), "utf-8");
}

function loadLogs(): ActivationLog[] {
  if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2), "utf-8");
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(LOGS_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}

function saveLogs(logs: ActivationLog[]) {
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), "utf-8");
}

function logAction(key: string, hwid: string, action: string, status: string, ip: string) {
  const logs = loadLogs();
  logs.unshift({
    timestamp: new Date().toISOString(),
    key,
    hwid,
    action,
    status,
    ip,
  });
  saveLogs(logs.slice(0, 1000)); // Limit to last 1000 logs
}

// Generate signature: KEY:HWID:EXPIRES_AT signed with HMAC-SHA256
function generateSignature(key: string, hwid: string, expiresAt: string): string {
  const message = `${key}:${hwid}:${expiresAt}`;
  return crypto.createHmac("sha256", SIGNATURE_SECRET).update(message).digest("hex");
}

// Express middlewares
app.use(express.json());

// API: Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// API: Activate License
app.post("/api/license/activate", (req, res) => {
  const { key, hwid } = req.body;
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "") as string;

  if (!key || !hwid) {
    return res.status(400).json({ success: false, error: "Missing license key or hardware ID (HWID)" });
  }

  const licenses = loadLicenses();
  const license = licenses.find((l) => l.key.toUpperCase() === key.toUpperCase());

  if (!license) {
    logAction(key, hwid, "activate", "Invalid license key", ip);
    return res.status(404).json({ success: false, error: "License key not found" });
  }

  if (!license.active) {
    logAction(key, hwid, "activate", "License is disabled/revoked", ip);
    return res.status(403).json({ success: false, error: "License is disabled or revoked" });
  }

  // Check expiration date
  const expDate = new Date(license.expiresAt);
  const today = new Date();
  if (expDate < today) {
    logAction(key, hwid, "activate", "License expired", ip);
    return res.status(403).json({ success: false, error: "License key has expired" });
  }

  // Handle device limits
  if (!license.activatedDevices.includes(hwid)) {
    if (license.activatedDevices.length >= license.maxDevices) {
      logAction(key, hwid, "activate", "Device limit reached", ip);
      return res.status(403).json({ success: false, error: `Device activation limit of ${license.maxDevices} reached` });
    }
    license.activatedDevices.push(hwid);
    saveLicenses(licenses);
  }

  const signature = generateSignature(license.key, hwid, license.expiresAt);
  logAction(key, hwid, "activate", "Success", ip);

  res.json({
    success: true,
    key: license.key,
    hwid: hwid,
    expires_at: license.expiresAt,
    tier: license.tier,
    signature: signature,
  });
});

// API: Verify/Check Status
app.post("/api/license/status", (req, res) => {
  const { key, hwid } = req.body;
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "") as string;

  if (!key || !hwid) {
    return res.status(400).json({ success: false, error: "Missing license key or HWID" });
  }

  const licenses = loadLicenses();
  const license = licenses.find((l) => l.key.toUpperCase() === key.toUpperCase());

  if (!license || !license.active) {
    logAction(key, hwid, "status_check", "Invalid/Inactive License", ip);
    return res.json({ success: false, error: "License invalid, disabled or revoked" });
  }

  // Check expiration
  const expDate = new Date(license.expiresAt);
  const today = new Date();
  if (expDate < today) {
    logAction(key, hwid, "status_check", "Expired License", ip);
    return res.json({ success: false, error: "License key has expired" });
  }

  // Check if HWID is registered
  if (!license.activatedDevices.includes(hwid)) {
    logAction(key, hwid, "status_check", "HWID mismatch", ip);
    return res.json({ success: false, error: "This hardware ID is not activated for this license" });
  }

  const signature = generateSignature(license.key, hwid, license.expiresAt);
  logAction(key, hwid, "status_check", "Verified", ip);

  res.json({
    success: true,
    key: license.key,
    hwid: hwid,
    expires_at: license.expiresAt,
    tier: license.tier,
    signature: signature,
  });
});

// Admin Panel API Endpoints (Commercial Panel)
app.get("/api/admin/licenses", (req, res) => {
  res.json(loadLicenses());
});

app.post("/api/admin/licenses", (req, res) => {
  const { key, tier, maxDevices, expiresAt } = req.body;
  if (!key || !tier || !maxDevices || !expiresAt) {
    return res.status(400).json({ error: "Missing required license fields" });
  }

  const licenses = loadLicenses();
  if (licenses.some((l) => l.key.toUpperCase() === key.toUpperCase())) {
    return res.status(400).json({ error: "License key already exists" });
  }

  const newLicense: License = {
    key: key.toUpperCase(),
    tier,
    maxDevices: parseInt(maxDevices, 10),
    activatedDevices: [],
    expiresAt,
    active: true,
    createdAt: new Date().toISOString(),
  };

  licenses.push(newLicense);
  saveLicenses(licenses);
  res.status(201).json(newLicense);
});

app.patch("/api/admin/licenses/:key/toggle", (req, res) => {
  const { key } = req.params;
  const licenses = loadLicenses();
  const license = licenses.find((l) => l.key.toUpperCase() === key.toUpperCase());

  if (!license) {
    return res.status(404).json({ error: "License not found" });
  }

  license.active = !license.active;
  saveLicenses(licenses);
  res.json(license);
});

app.delete("/api/admin/licenses/:key", (req, res) => {
  const { key } = req.params;
  let licenses = loadLicenses();
  const exists = licenses.some((l) => l.key.toUpperCase() === key.toUpperCase());

  if (!exists) {
    return res.status(404).json({ error: "License not found" });
  }

  licenses = licenses.filter((l) => l.key.toUpperCase() !== key.toUpperCase());
  saveLicenses(licenses);
  res.json({ success: true });
});

app.get("/api/admin/logs", (req, res) => {
  res.json(loadLogs());
});

async function startServer() {
  // Initialize licenses database
  loadLicenses();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`License Server running on port ${PORT}`);
  });
}

startServer();
