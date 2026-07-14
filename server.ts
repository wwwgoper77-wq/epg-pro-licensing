import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const SIGNATURE_SECRET = process.env.SIGNATURE_SECRET || 'EPG_ARABIC_SECRET_2026_XYZ_9876543213333454';

if (process.env.NODE_ENV === 'production' && SIGNATURE_SECRET === 'EPG_PRO_SECURE_SALT_9933') {
  console.warn('⚠️ WARNING: Using default insecure SIGNATURE_SECRET. Please configure a custom secret in production.');
}

// Generate secure HMAC-SHA256 signature bound to license parameters
function generateHmacSignature(key: string, hwid: string, expiresAt: string): string {
  const message = `${key}:${hwid}:${expiresAt}`;
  return crypto.createHmac('sha256', SIGNATURE_SECRET).update(message).digest('hex');
}

// Generate signature using HMAC-SHA256 of sorted key-value pairs (retained for general admin/JSON payload signatures)
function signResponse(data: any): any {
  const timestamp = data.timestamp || Date.now();
  const baseData = { ...data, timestamp };
  
  const sortedKeys = Object.keys(baseData).sort();
  const parts: string[] = [];
  for (const key of sortedKeys) {
    if (key === 'signature') continue;
    const val = baseData[key];
    if (val === null || val === undefined) {
      parts.push(`${key}:`);
    } else if (typeof val === 'object') {
      parts.push(`${key}:${JSON.stringify(val)}`);
    } else {
      parts.push(`${key}:${val}`);
    }
  }
  const message = parts.join('|');
  const signature = crypto.createHmac('sha256', SIGNATURE_SECRET).update(message).digest('hex');
  
  return { ...baseData, signature };
}

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Data directory and file paths for persistent storage inside the container
const DATA_DIR = path.join(process.cwd(), 'data');
const LICENSES_FILE = path.join(DATA_DIR, 'licenses.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

// Interface Declarations
export interface License {
  id: string;
  key: string; // Format: EPGPRO-XXXX-XXXX-XXXX-XXXX
  clientName: string;
  clientEmail: string;
  tier: 'standard' | 'premium' | 'enterprise';
  status: 'active' | 'suspended' | 'expired';
  maxDevices: number; // 0 for unlimited
  activatedDevices: string[]; // List of registered Device IDs
  expiresAt: string; // ISO String or 'never'
  createdAt: string;
  notes?: string;
}

export interface ActivationLog {
  id: string;
  timestamp: string;
  licenseKey: string;
  clientName: string;
  action: 'validate' | 'activate' | 'deactivate' | 'failed_validation';
  status: 'success' | 'failed';
  deviceId?: string;
  ipAddress?: string;
  reason?: string;
}

// Ensure the persistent data directory and files exist
function initDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Seed default licenses if file does not exist
  if (!fs.existsSync(LICENSES_FILE)) {
    const seedLicenses: License[] = [
      {
        id: 'lic_1',
        key: 'EPGPRO-DEMO-STAN-8721-9923',
        clientName: 'Acme Broadcasters',
        clientEmail: 'billing@acmebroadcast.com',
        tier: 'standard',
        status: 'active',
        maxDevices: 3,
        activatedDevices: ['dev_mac_01a', 'dev_win_02b'],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        createdAt: new Date().toISOString(),
        notes: 'Initial standard broadcast license for testing feed ingestors.'
      },
      {
        id: 'lic_2',
        key: 'EPGPRO-GOLD-PREM-4451-8890',
        clientName: 'Vortex IPTV Solutions',
        clientEmail: 'support@vortexiptv.io',
        tier: 'premium',
        status: 'active',
        maxDevices: 10,
        activatedDevices: [],
        expiresAt: 'never',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Perpetual premium tier. Waiting for deployment on vortex main nodes.'
      },
      {
        id: 'lic_3',
        key: 'EPGPRO-CORP-ENTR-0091-7711',
        clientName: 'Global Media Networks Corp',
        clientEmail: 'licensing@globalmedianet.com',
        tier: 'enterprise',
        status: 'suspended',
        maxDevices: 0, // unlimited
        activatedDevices: ['edge_node_london', 'edge_node_ny', 'edge_node_tokyo'],
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Enterprise account. Temporarily suspended due to billing recalculation.'
      }
    ];
    fs.writeFileSync(LICENSES_FILE, JSON.stringify(seedLicenses, null, 2), 'utf-8');
  }

  if (!fs.existsSync(LOGS_FILE)) {
    const seedLogs: ActivationLog[] = [
      {
        id: 'log_1',
        timestamp: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
        licenseKey: 'EPGPRO-DEMO-STAN-8721-9923',
        clientName: 'Acme Broadcasters',
        action: 'validate',
        status: 'success',
        deviceId: 'dev_mac_01a',
        ipAddress: '192.168.1.104',
        reason: 'License key successfully verified on registered Mac station.'
      },
      {
        id: 'log_2',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        licenseKey: 'EPGPRO-DEMO-STAN-8721-9923',
        clientName: 'Acme Broadcasters',
        action: 'activate',
        status: 'success',
        deviceId: 'dev_win_02b',
        ipAddress: '203.0.113.82',
        reason: 'New device dev_win_02b registered. Activations: 2/3.'
      },
      {
        id: 'log_3',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        licenseKey: 'EPGPRO-CORP-ENTR-0091-7711',
        clientName: 'Global Media Networks Corp',
        action: 'validate',
        status: 'failed',
        deviceId: 'edge_node_singapore',
        ipAddress: '198.51.100.12',
        reason: 'License verification blocked. Key is currently suspended.'
      }
    ];
    fs.writeFileSync(LOGS_FILE, JSON.stringify(seedLogs, null, 2), 'utf-8');
  }
}

initDatabase();

// Load & Save Helpers
function getLicenses(): License[] {
  try {
    const content = fs.readFileSync(LICENSES_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading licenses database:', error);
    return [];
  }
}

function saveLicenses(licenses: License[]) {
  try {
    fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving licenses database:', error);
  }
}

function getLogs(): ActivationLog[] {
  try {
    const content = fs.readFileSync(LOGS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading logs database:', error);
    return [];
  }
}

function saveLogs(logs: ActivationLog[]) {
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving logs database:', error);
  }
}

// Generate secure keys formatted like: EPGPRO-[TIER]-[RANDOM]-[RANDOM]
function generateLicenseKey(tier: string): string {
  const segment = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1).toUpperCase();
  const tierPrefix = tier.substring(0, 4).toUpperCase();
  return `EPGPRO-${tierPrefix}-${segment()}-${segment()}-${segment()}`;
}

// API Routes

// 1. Get All Licenses
app.get('/api/licenses', (req, res) => {
  const licenses = getLicenses();
  res.json(licenses);
});

// 2. Generate a New License Key
app.post('/api/licenses', (req, res) => {
  const { clientName, clientEmail, tier, maxDevices, expiresAt, notes } = req.body;

  if (!clientName || !clientEmail || !tier) {
    return res.status(400).json({ error: 'Missing required customer parameters.' });
  }

  const licenses = getLicenses();
  const newLicense: License = {
    id: `lic_${Date.now()}`,
    key: generateLicenseKey(tier),
    clientName,
    clientEmail,
    tier: tier as 'standard' | 'premium' | 'enterprise',
    status: 'active',
    maxDevices: parseInt(maxDevices) || 0,
    activatedDevices: [],
    expiresAt: expiresAt || 'never',
    createdAt: new Date().toISOString(),
    notes: notes || ''
  };

  licenses.unshift(newLicense);
  saveLicenses(licenses);

  // Add system creation log
  const logs = getLogs();
  const creationLog: ActivationLog = {
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    licenseKey: newLicense.key,
    clientName: newLicense.clientName,
    action: 'activate',
    status: 'success',
    reason: `License key created successfully for tier: ${newLicense.tier.toUpperCase()}`
  };
  logs.unshift(creationLog);
  saveLogs(logs);

  res.status(201).json(newLicense);
});

// 3. Edit / Update License Status and Config
app.put('/api/licenses/:id', (req, res) => {
  const { id } = req.params;
  const { status, tier, maxDevices, expiresAt, notes, clientName, clientEmail } = req.body;

  const licenses = getLicenses();
  const index = licenses.findIndex(l => l.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'License key not found.' });
  }

  const oldLicense = licenses[index];
  const updatedLicense: License = {
    ...oldLicense,
    status: status || oldLicense.status,
    tier: tier || oldLicense.tier,
    maxDevices: maxDevices !== undefined ? parseInt(maxDevices) : oldLicense.maxDevices,
    expiresAt: expiresAt !== undefined ? expiresAt : oldLicense.expiresAt,
    notes: notes !== undefined ? notes : oldLicense.notes,
    clientName: clientName || oldLicense.clientName,
    clientEmail: clientEmail || oldLicense.clientEmail
  };

  // If status is updated to expired/suspended, we might want to check
  licenses[index] = updatedLicense;
  saveLicenses(licenses);

  // Add updating event log
  const logs = getLogs();
  const updateLog: ActivationLog = {
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    licenseKey: updatedLicense.key,
    clientName: updatedLicense.clientName,
    action: 'validate',
    status: 'success',
    reason: `License details updated. Status changed to: ${updatedLicense.status.toUpperCase()}`
  };
  logs.unshift(updateLog);
  saveLogs(logs);

  res.json(updatedLicense);
});

// 4. Delete / Revoke License
app.delete('/api/licenses/:id', (req, res) => {
  const { id } = req.params;
  const licenses = getLicenses();
  const licenseToDelete = licenses.find(l => l.id === id);

  if (!licenseToDelete) {
    return res.status(404).json({ error: 'License key not found.' });
  }

  const filtered = licenses.filter(l => l.id !== id);
  saveLicenses(filtered);

  // Add system audit log
  const logs = getLogs();
  const deleteLog: ActivationLog = {
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    licenseKey: licenseToDelete.key,
    clientName: licenseToDelete.clientName,
    action: 'deactivate',
    status: 'success',
    reason: `License revoked and permanently purged from server registry.`
  };
  logs.unshift(deleteLog);
  saveLogs(logs);

  res.json({ message: 'License successfully revoked.' });
});

// 5. Reset Activated Devices (Clear activations to let client re-register)
app.post('/api/licenses/:id/reset', (req, res) => {
  const { id } = req.params;
  const licenses = getLicenses();
  const index = licenses.findIndex(l => l.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'License not found.' });
  }

  const license = licenses[index];
  const oldDevicesCount = license.activatedDevices.length;
  license.activatedDevices = [];
  licenses[index] = license;
  saveLicenses(licenses);

  // Add logs
  const logs = getLogs();
  const resetLog: ActivationLog = {
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    licenseKey: license.key,
    clientName: license.clientName,
    action: 'deactivate',
    status: 'success',
    reason: `Cleared all registered device IDs (${oldDevicesCount} active device slots released).`
  };
  logs.unshift(resetLog);
  saveLogs(logs);

  res.json(license);
});

// 5.1 Enigma2 Legacy Client - Activate License Endpoint
app.all('/api/license/activate', (req, res) => {
  const licenseKey = (req.body.licenseKey || req.body.key || req.query.licenseKey || req.query.key || '').toString().trim();
  const deviceId = (req.body.deviceId || req.body.hwid || req.query.deviceId || req.query.hwid || '').toString().trim();
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  if (!licenseKey || !deviceId) {
    return res.status(400).json({ 
      success: false, 
      message: 'License key and device ID/HWID are required.' 
    });
  }

  const licenses = getLicenses();
  const license = licenses.find(l => l.key.trim().toUpperCase() === licenseKey.toUpperCase());
  const logs = getLogs();

  if (!license) {
    const errorLog: ActivationLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      licenseKey,
      clientName: 'Unknown Enigma2 Client',
      action: 'failed_validation',
      status: 'failed',
      deviceId,
      ipAddress: String(ipAddress),
      reason: 'Activation failed: License key not registered.'
    };
    logs.unshift(errorLog);
    saveLogs(logs);
    return res.status(404).json({ 
      success: false, 
      message: 'License key not registered.' 
    });
  }

  // Check suspended status
  if (license.status === 'suspended') {
    const errorLog: ActivationLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      licenseKey: license.key,
      clientName: license.clientName,
      action: 'failed_validation',
      status: 'failed',
      deviceId,
      ipAddress: String(ipAddress),
      reason: 'Activation blocked: License is suspended.'
    };
    logs.unshift(errorLog);
    saveLogs(logs);
    return res.status(403).json({ 
      success: false, 
      message: 'This license has been suspended.' 
    });
  }

  // Check expired status
  if (license.expiresAt !== 'never') {
    const expiryDate = new Date(license.expiresAt);
    if (expiryDate.getTime() < Date.now()) {
      if (license.status !== 'expired') {
        license.status = 'expired';
        saveLicenses(licenses);
      }
      const errorLog: ActivationLog = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        licenseKey: license.key,
        clientName: license.clientName,
        action: 'failed_validation',
        status: 'failed',
        deviceId,
        ipAddress: String(ipAddress),
        reason: 'Activation failed: License is expired.'
      };
      logs.unshift(errorLog);
      saveLogs(logs);
      return res.status(403).json({ 
        success: false, 
        message: 'This license has expired.' 
      });
    }
  }

  // Already registered device check
  const isAlreadyRegistered = license.activatedDevices.includes(deviceId);
  if (isAlreadyRegistered) {
    const log: ActivationLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      licenseKey: license.key,
      clientName: license.clientName,
      action: 'activate',
      status: 'success',
      deviceId,
      ipAddress: String(ipAddress),
      reason: `Device already activated. Total: ${license.activatedDevices.length}/${license.maxDevices || 'unlimited'}`
    };
    logs.unshift(log);
    saveLogs(logs);
    
    const signature = generateHmacSignature(license.key, deviceId, license.expiresAt);
    return res.json({
      success: true,
      message: 'Device already registered and activated.',
      key: license.key,
      licenseKey: license.key,
      hwid: deviceId,
      deviceId,
      status: license.status,
      tier: license.tier,
      expires_at: license.expiresAt,
      expiresAt: license.expiresAt,
      clientName: license.clientName,
      signature
    });
  }

  // Check device slots
  if (license.maxDevices > 0 && license.activatedDevices.length >= license.maxDevices) {
    const errorLog: ActivationLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      licenseKey: license.key,
      clientName: license.clientName,
      action: 'failed_validation',
      status: 'failed',
      deviceId,
      ipAddress: String(ipAddress),
      reason: `Activation failed: Maximum device limit of ${license.maxDevices} reached.`
    };
    logs.unshift(errorLog);
    saveLogs(logs);
    return res.status(403).json({
      success: false,
      message: `Activation slots filled. Max of ${license.maxDevices} devices reached.`
    });
  }

  // Success, register device
  license.activatedDevices.push(deviceId);
  saveLicenses(licenses);

  const okLog: ActivationLog = {
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    licenseKey: license.key,
    clientName: license.clientName,
    action: 'activate',
    status: 'success',
    deviceId,
    ipAddress: String(ipAddress),
    reason: `Enigma2 device registered and activated successfully. Slot: ${license.activatedDevices.length}/${license.maxDevices || 'unlimited'}`
  };
  logs.unshift(okLog);
  saveLogs(logs);

  const signature = generateHmacSignature(license.key, deviceId, license.expiresAt);
  return res.json({
    success: true,
    message: 'License activated successfully on device.',
    key: license.key,
    licenseKey: license.key,
    hwid: deviceId,
    deviceId,
    status: license.status,
    tier: license.tier,
    expires_at: license.expiresAt,
    expiresAt: license.expiresAt,
    clientName: license.clientName,
    signature
  });
});

// 5.2 Enigma2 Legacy Client - Verify License Endpoint
app.all('/api/license/verify', (req, res) => {
  const licenseKey = (req.body.licenseKey || req.body.key || req.query.licenseKey || req.query.key || '').toString().trim();
  const deviceId = (req.body.deviceId || req.body.hwid || req.query.deviceId || req.query.hwid || '').toString().trim();
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  if (!licenseKey || !deviceId) {
    return res.status(400).json({ 
      success: false, 
      message: 'License key and device ID/HWID are required.' 
    });
  }

  const licenses = getLicenses();
  const license = licenses.find(l => l.key.trim().toUpperCase() === licenseKey.toUpperCase());
  const logs = getLogs();

  if (!license) {
    return res.status(404).json({ 
      success: false, 
      message: 'License key not registered.' 
    });
  }

  // Check suspended
  if (license.status === 'suspended') {
    return res.status(403).json({ 
      success: false, 
      message: 'This license has been suspended.' 
    });
  }

  // Check expired
  if (license.expiresAt !== 'never') {
    const expiryDate = new Date(license.expiresAt);
    if (expiryDate.getTime() < Date.now()) {
      if (license.status !== 'expired') {
        license.status = 'expired';
        saveLicenses(licenses);
      }
      return res.status(403).json({ 
        success: false, 
        message: 'This license has expired.' 
      });
    }
  }

  // Verify device registration
  const isRegistered = license.activatedDevices.includes(deviceId);
  if (!isRegistered) {
    const errorLog: ActivationLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      licenseKey: license.key,
      clientName: license.clientName,
      action: 'failed_validation',
      status: 'failed',
      deviceId,
      ipAddress: String(ipAddress),
      reason: 'Verification failed: Device not registered for this license.'
    };
    logs.unshift(errorLog);
    saveLogs(logs);
    return res.status(403).json({ 
      success: false, 
      message: 'Device not registered. Please activate first.' 
    });
  }

  // Success, device validated
  const okLog: ActivationLog = {
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    licenseKey: license.key,
    clientName: license.clientName,
    action: 'validate',
    status: 'success',
    deviceId,
    ipAddress: String(ipAddress),
    reason: 'Enigma2 device validation successful.'
  };
  logs.unshift(okLog);
  saveLogs(logs);

  const signature = generateHmacSignature(license.key, deviceId, license.expiresAt);
  return res.json({
    success: true,
    message: 'License verified.',
    key: license.key,
    licenseKey: license.key,
    hwid: deviceId,
    deviceId,
    status: license.status,
    tier: license.tier,
    expires_at: license.expiresAt,
    expiresAt: license.expiresAt,
    clientName: license.clientName,
    signature
  });
});

// 6. Public License Validation & Activation API
// Used by customer integrations / EPG-PRO Client apps
app.all('/api/licenses/validate', (req, res) => {
  const licenseKey = (req.body.licenseKey || req.body.key || req.query.licenseKey || req.query.key || '').toString().trim();
  const deviceId = (req.body.deviceId || req.body.hwid || req.query.deviceId || req.query.hwid || '').toString().trim();
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  if (!licenseKey) {
    return res.status(400).json({ valid: false, reason: 'License key parameter is missing.' });
  }

  const licenses = getLicenses();
  const license = licenses.find(l => l.key.trim().toUpperCase() === licenseKey.toUpperCase());
  const logs = getLogs();

  if (!license) {
    const errorLog: ActivationLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      licenseKey: licenseKey,
      clientName: 'Unknown Caller',
      action: 'failed_validation',
      status: 'failed',
      deviceId: deviceId || 'unknown_station',
      ipAddress: String(ipAddress),
      reason: 'Validation attempt failed: License key not registered.'
    };
    logs.unshift(errorLog);
    saveLogs(logs);
    return res.status(403).json({ valid: false, reason: 'License key not registered in database.' });
  }

  // Check if suspended
  if (license.status === 'suspended') {
    const errorLog: ActivationLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      licenseKey: license.key,
      clientName: license.clientName,
      action: 'failed_validation',
      status: 'failed',
      deviceId: deviceId || 'unknown_station',
      ipAddress: String(ipAddress),
      reason: 'Validation attempt blocked: License is suspended.'
    };
    logs.unshift(errorLog);
    saveLogs(logs);
    return res.status(403).json({ valid: false, reason: 'This license has been suspended.' });
  }

  // Check if expired
  if (license.expiresAt !== 'never') {
    const expiryDate = new Date(license.expiresAt);
    if (expiryDate.getTime() < Date.now()) {
      // Auto-update status to expired if not already
      if (license.status !== 'expired') {
        license.status = 'expired';
        saveLicenses(licenses);
      }

      const errorLog: ActivationLog = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        licenseKey: license.key,
        clientName: license.clientName,
        action: 'failed_validation',
        status: 'failed',
        deviceId: deviceId || 'unknown_station',
        ipAddress: String(ipAddress),
        reason: 'Validation attempt failed: License is expired.'
      };
      logs.unshift(errorLog);
      saveLogs(logs);
      return res.status(403).json({ valid: false, reason: 'This license has expired.' });
    }
  }

  // Device Validation / Activation check
  if (!deviceId) {
    // If no device ID supplied, simply validate key state
    const infoLog: ActivationLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      licenseKey: license.key,
      clientName: license.clientName,
      action: 'validate',
      status: 'success',
      ipAddress: String(ipAddress),
      reason: 'Key validation successful (no device registration requested).'
    };
    logs.unshift(infoLog);
    saveLogs(logs);

    return res.json({
      valid: true,
      license: {
        clientName: license.clientName,
        tier: license.tier,
        status: license.status,
        expiresAt: license.expiresAt,
        maxDevices: license.maxDevices,
        activatedDevicesCount: license.activatedDevices.length
      }
    });
  }

  // Device ID is supplied
  const isRegistered = license.activatedDevices.includes(deviceId);

  if (isRegistered) {
    // Already registered, validation successful
    const validationLog: ActivationLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      licenseKey: license.key,
      clientName: license.clientName,
      action: 'validate',
      status: 'success',
      deviceId,
      ipAddress: String(ipAddress),
      reason: `Key verified successfully. Device ${deviceId} is already registered.`
    };
    logs.unshift(validationLog);
    saveLogs(logs);

    return res.json({
      valid: true,
      action: 'verified',
      license: {
        clientName: license.clientName,
        tier: license.tier,
        expiresAt: license.expiresAt,
        maxDevices: license.maxDevices,
        activatedDevicesCount: license.activatedDevices.length
      }
    });
  } else {
    // Attempt registration
    if (license.maxDevices > 0 && license.activatedDevices.length >= license.maxDevices) {
      // Exceeds device slot limit
      const limitLog: ActivationLog = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        licenseKey: license.key,
        clientName: license.clientName,
        action: 'failed_validation',
        status: 'failed',
        deviceId,
        ipAddress: String(ipAddress),
        reason: `Activation failed: Device limit of ${license.maxDevices} reached.`
      };
      logs.unshift(limitLog);
      saveLogs(logs);

      return res.status(403).json({ 
        valid: false, 
        reason: `Activation slots filled. This license supports at most ${license.maxDevices} devices. Please reset activations in EPG-PRO console.` 
      });
    }

    // Register the device
    license.activatedDevices.push(deviceId);
    saveLicenses(licenses);

    const activationLog: ActivationLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      licenseKey: license.key,
      clientName: license.clientName,
      action: 'activate',
      status: 'success',
      deviceId,
      ipAddress: String(ipAddress),
      reason: `New device registered: ${deviceId}. Slot occupancy: ${license.activatedDevices.length}/${license.maxDevices || 'unlimited'}.`
    };
    logs.unshift(activationLog);
    saveLogs(logs);

    return res.json({
      valid: true,
      action: 'activated',
      license: {
        clientName: license.clientName,
        tier: license.tier,
        expiresAt: license.expiresAt,
        maxDevices: license.maxDevices,
        activatedDevicesCount: license.activatedDevices.length
      }
    });
  }
});

// 7. Get Activation / Validation Logs
app.get('/api/logs', (req, res) => {
  const logs = getLogs();
  res.json(logs);
});

// 8. Delete all Logs (Reset Audit)
app.post('/api/logs/clear', (req, res) => {
  const clearLog: ActivationLog = {
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    licenseKey: 'SYSTEM',
    clientName: 'Administrator',
    action: 'deactivate',
    status: 'success',
    reason: 'Auditing records purged by administrative console.'
  };
  fs.writeFileSync(LOGS_FILE, JSON.stringify([clearLog], null, 2), 'utf-8');
  res.json({ message: 'Logs successfully cleared.' });
});

// 9. Get Overall Server Statistics
app.get('/api/stats', (req, res) => {
  const licenses = getLicenses();
  const logs = getLogs();

  const totalLicenses = licenses.length;
  const activeLicenses = licenses.filter(l => l.status === 'active').length;
  const suspendedLicenses = licenses.filter(l => l.status === 'suspended').length;
  const expiredLicenses = licenses.filter(l => l.status === 'expired').length;

  const totalDevicesRegistered = licenses.reduce((sum, l) => sum + l.activatedDevices.length, 0);

  // Success rate of validation requests
  const validationAttempts = logs.filter(l => l.action === 'validate' || l.action === 'activate' || l.action === 'failed_validation');
  const totalAttempts = validationAttempts.length;
  const successfulAttempts = validationAttempts.filter(l => l.status === 'success').length;
  const successRate = totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 100;

  res.json({
    totalLicenses,
    activeLicenses,
    suspendedLicenses,
    expiredLicenses,
    totalDevicesRegistered,
    totalLogs: logs.length,
    successRate,
    totalAttempts
  });
});

// Railway health check
app.get('/health', (req, res) => {
  res.json({ status: 'online', service: 'EPG-PRO Licensing Server' });
});

// Setup Vite Dev Middleware in Development inside async start routine to support CJS
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EPG-PRO Licensing Server running on http://0.0.0.0:${PORT} [ENV: ${process.env.NODE_ENV || 'development'}]`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start EPG-PRO server node:', err);
});
