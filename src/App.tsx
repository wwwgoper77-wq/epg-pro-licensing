import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  Layers, 
  Key, 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Copy, 
  Terminal, 
  Activity, 
  HardDrive, 
  Globe, 
  Sliders, 
  Info, 
  Calendar, 
  Check,
  Code,
  Sparkles,
  Database
} from 'lucide-react';

// Interfaces aligned with our server.ts backend
interface License {
  id: string;
  key: string;
  clientName: string;
  clientEmail: string;
  tier: 'standard' | 'premium' | 'enterprise';
  status: 'active' | 'suspended' | 'expired';
  maxDevices: number;
  activatedDevices: string[];
  expiresAt: string;
  createdAt: string;
  notes?: string;
}

interface ActivationLog {
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

interface ServerStats {
  totalLicenses: number;
  activeLicenses: number;
  suspendedLicenses: number;
  expiredLicenses: number;
  totalDevicesRegistered: number;
  totalLogs: number;
  successRate: number;
  totalAttempts: number;
}

export default function App() {
  // Navigation & View States
  const [activeTab, setActiveTab] = useState<'licenses' | 'tester' | 'audit'>('licenses');
  
  // Data States
  const [licenses, setLicenses] = useState<License[]>([]);
  const [logs, setLogs] = useState<ActivationLog[]>([]);
  const [stats, setStats] = useState<ServerStats>({
    totalLicenses: 0,
    activeLicenses: 0,
    suspendedLicenses: 0,
    expiredLicenses: 0,
    totalDevicesRegistered: 0,
    totalLogs: 0,
    successRate: 100,
    totalAttempts: 0
  });

  // UI Interactive States
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [logsSearch, setLogsSearch] = useState('');
  
  // Create / Generate License Form States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTier, setFormTier] = useState<'standard' | 'premium' | 'enterprise'>('standard');
  const [formMaxDevices, setFormMaxDevices] = useState('5');
  const [formExpiresPreset, setFormExpiresPreset] = useState<'30days' | '1year' | 'perpetual'>('1year');
  const [formNotes, setFormNotes] = useState('');
  const [newlyCreatedLicense, setNewlyCreatedLicense] = useState<License | null>(null);

  // Edit License Modal States
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [editStatus, setEditStatus] = useState<'active' | 'suspended' | 'expired'>('active');
  const [editMaxDevices, setEditMaxDevices] = useState('5');
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // API Client Tester Playground States
  const [testerKey, setTesterKey] = useState('');
  const [testerDeviceId, setTesterDeviceId] = useState('epg_player_office_1');
  const [testerRegister, setTesterRegister] = useState(true);
  const [testerResponse, setTesterResponse] = useState<any>(null);
  const [testerStatus, setTesterStatus] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // General Loading & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Fetch initial data
  const fetchData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [licRes, logRes, statsRes] = await Promise.all([
        fetch('/api/licenses'),
        fetch('/api/logs'),
        fetch('/api/stats')
      ]);

      if (!licRes.ok || !logRes.ok || !statsRes.ok) {
        throw new Error('Failed to synchronize server configuration.');
      }

      const licensesData = await licRes.json();
      const logsData = await logRes.json();
      const statsData = await statsRes.json();

      setLicenses(licensesData);
      setLogs(logsData);
      setStats(statsData);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Endpoint unreachable. Ensure server is active and bound to port 3000.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Show dynamic toast helper
  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  // Handle License Key Copy
  const handleCopy = (keyText: string) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKey(keyText);
    showToast('License Key copied to clipboard!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Generate a New License Key
  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      setErrorMsg('Please specify both customer name and email.');
      return;
    }

    let calculatedExpiry = 'never';
    if (formExpiresPreset === '30days') {
      calculatedExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (formExpiresPreset === '1year') {
      calculatedExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    }

    try {
      const response = await fetch('/api/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: formName,
          clientEmail: formEmail,
          tier: formTier,
          maxDevices: formMaxDevices,
          expiresAt: calculatedExpiry,
          notes: formNotes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate license key.');
      }

      const newLic = await response.json();
      setNewlyCreatedLicense(newLic);
      showToast('New license key generated successfully!');
      
      // Reset form states
      setFormName('');
      setFormEmail('');
      setFormTier('standard');
      setFormMaxDevices('5');
      setFormExpiresPreset('1year');
      setFormNotes('');

      // Refresh stats and listing
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while saving license key.');
    }
  };

  // Handle License Updates
  const handleUpdateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLicense) return;

    try {
      const response = await fetch(`/api/licenses/${editingLicense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus,
          maxDevices: editMaxDevices,
          expiresAt: editExpiresAt || 'never',
          notes: editNotes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update license key properties.');
      }

      setEditingLicense(null);
      showToast('License status updated successfully.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating license.');
    }
  };

  // Open Edit Modal Helper
  const openEditModal = (license: License) => {
    setEditingLicense(license);
    setEditStatus(license.status);
    setEditMaxDevices(String(license.maxDevices));
    setEditExpiresAt(license.expiresAt === 'never' ? '' : license.expiresAt.substring(0, 16));
    setEditNotes(license.notes || '');
  };

  // Revoke License
  const handleRevokeLicense = async (id: string, keyName: string) => {
    if (!window.confirm(`Are you absolutely sure you want to REVOKE the license key for ${keyName}? This action is permanent and will block client clients immediately.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/licenses/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to revoke license.');
      }

      showToast('License key successfully revoked.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error revoking license.');
    }
  };

  // Reset activations for a license
  const handleResetActivations = async (id: string, clientName: string) => {
    if (!window.confirm(`Reset device registrations for ${clientName}? All active slots will be freed up, permitting hardware reassignment.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/licenses/${id}/reset`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to clear client device list.');
      }

      showToast('Registered device slots successfully released.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error releasing device registrations.');
    }
  };

  // Clear Audit Logs
  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all validation and audit logs from this server?')) {
      return;
    }

    try {
      const response = await fetch('/api/logs/clear', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to clear logs.');
      }

      showToast('Audit registry cleared.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to clear registry.');
    }
  };

  // Run the API Simulator Validation Request
  const handleTestAPI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testerKey.trim()) return;

    setIsTesting(true);
    setTesterResponse(null);
    setTesterStatus(null);

    try {
      const payload: any = { licenseKey: testerKey.trim() };
      if (testerRegister && testerDeviceId.trim()) {
        payload.deviceId = testerDeviceId.trim();
      }

      const response = await fetch('/api/licenses/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      setTesterStatus(response.status);
      const resData = await response.json();
      setTesterResponse(resData);

      // Re-fetch database metrics in background to reflect simulator hits
      fetchData();
    } catch (err: any) {
      setTesterResponse({ error: 'Network failure or server offline.' });
      setTesterStatus(500);
    } finally {
      setIsTesting(false);
    }
  };

  // Load Copy Snippet for the Tester Tab
  const copySnippet = (language: 'curl' | 'js' | 'python') => {
    let code = '';
    const endpointUrl = `${window.location.origin}/api/licenses/validate`;
    const cleanedKey = testerKey || 'EPGPRO-DEMO-STAN-8721-9923';
    const cleanedDev = testerDeviceId || 'epg_player_office_1';

    if (language === 'curl') {
      code = `curl -X POST "${endpointUrl}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"licenseKey": "${cleanedKey}", "deviceId": "${cleanedDev}"}'`;
    } else if (language === 'js') {
      code = `fetch("${endpointUrl}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    licenseKey: "${cleanedKey}",\n    deviceId: "${cleanedDev}"\n  })\n})\n.then(res => res.json())\n.then(data => console.log(data));`;
    } else if (language === 'python') {
      code = `import requests\n\nurl = "${endpointUrl}"\npayload = {\n    "licenseKey": "${cleanedKey}",\n    "deviceId": "${cleanedDev}"\n}\n\nresponse = requests.post(url, json=payload)\nprint(response.json())`;
    }

    navigator.clipboard.writeText(code);
    showToast(`Copied ${language.toUpperCase()} integration snippet!`);
  };

  // Memoized Search & Filter on Licenses
  const filteredLicenses = useMemo(() => {
    return licenses.filter(lic => {
      const keyMatch = lic.key.toLowerCase().includes(searchQuery.toLowerCase());
      const nameMatch = lic.clientName.toLowerCase().includes(searchQuery.toLowerCase());
      const emailMatch = lic.clientEmail.toLowerCase().includes(searchQuery.toLowerCase());
      const notesMatch = lic.notes?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
      const matchesSearch = keyMatch || nameMatch || emailMatch || notesMatch;

      const matchesTier = tierFilter === 'all' || lic.tier === tierFilter;
      const matchesStatus = statusFilter === 'all' || lic.status === statusFilter;

      return matchesSearch && matchesTier && matchesStatus;
    });
  }, [licenses, searchQuery, tierFilter, statusFilter]);

  // Memoized Search on Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const keyMatch = log.licenseKey.toLowerCase().includes(logsSearch.toLowerCase());
      const nameMatch = log.clientName.toLowerCase().includes(logsSearch.toLowerCase());
      const reasonMatch = log.reason?.toLowerCase().includes(logsSearch.toLowerCase()) || false;
      const deviceMatch = log.deviceId?.toLowerCase().includes(logsSearch.toLowerCase()) || false;
      const ipMatch = log.ipAddress?.toLowerCase().includes(logsSearch.toLowerCase()) || false;
      const actionMatch = log.action.toLowerCase().includes(logsSearch.toLowerCase());

      return keyMatch || nameMatch || reasonMatch || deviceMatch || ipMatch || actionMatch;
    });
  }, [logs, logsSearch]);

  return (
    <div id="epgpro-licensing-root" className="min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col antialiased">
      
      {/* Dynamic Success Notification */}
      {successToast && (
        <div id="system-toast" className="fixed top-6 right-6 z-50 bg-stone-900 text-stone-100 border border-stone-800 text-xs py-3 px-5 rounded-xl shadow-xl flex items-center gap-3 animate-slide-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="font-medium">{successToast}</span>
        </div>
      )}

      {/* Main Server Header */}
      <header id="control-header" className="bg-[#1C1917] border-b border-stone-800 text-stone-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-[#1C1917] flex items-center justify-center font-black text-lg shadow-lg shadow-amber-500/10">
              EP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">EPG-PRO Licensing</h1>
                <span className="text-[9px] font-mono font-bold tracking-widest px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded uppercase">Server V2.4</span>
              </div>
              <p className="text-xs text-stone-400">Enterprise Broadcast Key Administration & Telemetry Console</p>
            </div>
          </div>

          {/* Core Server Node Status Metabar */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 bg-stone-800/80 border border-stone-700/60 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-stone-300">NODE STATUS: ONLINE</span>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-stone-800/80 border border-stone-700/60 px-3 py-1.5 rounded-lg">
              <Database className="w-3.5 h-3.5 text-stone-400" />
              <span className="text-stone-300">STORE: JSON FILE VAULT</span>
            </div>
            <button 
              id="btn-manual-sync"
              onClick={fetchData} 
              className="p-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700/60 rounded-lg text-stone-300 hover:text-white transition-all"
              title="Force reload database metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Core Layout */}
      <main id="app-main-layout" className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        
        {/* Error Alert Bar */}
        {errorMsg && (
          <div id="error-banner" className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs flex-1">
              <h4 className="font-bold mb-0.5">Administrative Exception Raised</h4>
              <p className="text-stone-600">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-xs text-red-900 hover:underline font-bold uppercase">Acknowledge</button>
          </div>
        )}

        {/* 1. Executive Telemetry Overview Row */}
        <section id="executive-telemetry" className="grid grid-cols-1 md:grid-cols-4 gap-5">
          
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-widest block mb-1">Total Licenses Issued</span>
              <span className="text-3xl font-black text-stone-900 font-mono">{stats.totalLicenses}</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600">
              <Key className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-widest block mb-1">Active Stations</span>
              <span className="text-3xl font-black text-emerald-600 font-mono">{stats.activeLicenses}</span>
              <span className="text-[10px] text-stone-400 block mt-0.5">{stats.suspendedLicenses} suspended | {stats.expiredLicenses} expired</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-widest block mb-1">Total Devices Active</span>
              <span className="text-3xl font-black text-blue-600 font-mono">{stats.totalDevicesRegistered}</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Cpu className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-widest block mb-1">Validation Success Rate</span>
              <span className="text-3xl font-black text-amber-500 font-mono">{stats.successRate}%</span>
              <span className="text-[10px] text-stone-400 block mt-0.5">{stats.totalAttempts} historical inquiries</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
          </div>

        </section>

        {/* 2. Interactive Navigation Tabs bar */}
        <section id="navigation-bar" className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center border-b border-stone-200 pb-2 gap-4">
          <div className="flex gap-2 p-1 bg-stone-200/60 rounded-xl self-start">
            <button
              onClick={() => setActiveTab('licenses')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all duration-300
                ${activeTab === 'licenses' 
                  ? 'bg-white text-stone-950 shadow-sm' 
                  : 'text-stone-600 hover:text-stone-900'
                }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>License Keys Registry</span>
            </button>

            <button
              onClick={() => setActiveTab('tester')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all duration-300
                ${activeTab === 'tester' 
                  ? 'bg-white text-stone-950 shadow-sm' 
                  : 'text-stone-600 hover:text-stone-900'
                }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>API Integration Playground</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all duration-300
                ${activeTab === 'audit' 
                  ? 'bg-white text-stone-950 shadow-sm' 
                  : 'text-stone-600 hover:text-stone-900'
                }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>System Audit Logs</span>
            </button>
          </div>

          {activeTab === 'licenses' && (
            <button
              onClick={() => {
                setIsCreateOpen(true);
                setNewlyCreatedLicense(null);
                const targetForm = document.getElementById('new-license-form');
                targetForm?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-[#1C1917] font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/10 hover:scale-[1.01]"
            >
              <Plus className="w-4 h-4 text-[#1C1917]" />
              <span>Issue New License Key</span>
            </button>
          )}

          {activeTab === 'audit' && (
            <button
              onClick={handleClearLogs}
              className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Audit Logs</span>
            </button>
          )}
        </section>

        {/* 3. Core Tab Contents */}
        <section id="tab-window-pane" className="flex flex-col gap-8">
          
          {/* TAB 1: LICENSES MANAGER */}
          {activeTab === 'licenses' && (
            <div id="licenses-view-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Form: Create License Form (Only visible when toggled open) */}
              {isCreateOpen && (
                <div id="new-license-form" className="lg:col-span-4 bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5 animate-slide-in">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <span className="text-xs font-bold text-[#1C1917] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Issue Production License</span>
                    </span>
                    <button 
                      onClick={() => {
                        setIsCreateOpen(false);
                        setNewlyCreatedLicense(null);
                      }} 
                      className="text-stone-400 hover:text-stone-600 text-xs uppercase font-bold"
                    >
                      Close Form
                    </button>
                  </div>

                  <form onSubmit={handleCreateLicense} className="flex flex-col gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-stone-600 uppercase tracking-wider mb-1">Customer / Organization Name</label>
                      <input
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g. Paramount Broadcasters Ltd"
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-stone-600 uppercase tracking-wider mb-1">Customer Email Address</label>
                      <input
                        type="email"
                        required
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="e.g. licensing@paramountbroadcasters.com"
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-stone-600 uppercase tracking-wider mb-1">Product License Tier</label>
                        <select
                          value={formTier}
                          onChange={(e) => setFormTier(e.target.value as any)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                        >
                          <option value="standard">EPG Standard</option>
                          <option value="premium">EPG Premium</option>
                          <option value="enterprise">EPG Enterprise</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-stone-600 uppercase tracking-wider mb-1">Hardware Slots Limit</label>
                        <input
                          type="number"
                          value={formMaxDevices}
                          onChange={(e) => setFormMaxDevices(e.target.value)}
                          placeholder="e.g. 5 (0 for unlimited)"
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-stone-600 uppercase tracking-wider mb-1">Expiration Lifespan</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['30days', '1year', 'perpetual'] as const).map(preset => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setFormExpiresPreset(preset)}
                            className={`py-2 rounded-lg border text-center transition-all font-semibold uppercase text-[10px] tracking-wide
                              ${formExpiresPreset === preset 
                                ? 'bg-amber-500 border-amber-600 text-[#1C1917]' 
                                : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                              }`}
                          >
                            {preset === '30days' ? '30 Days' : preset === '1year' ? '1 Year' : 'Lifetime'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-stone-600 uppercase tracking-wider mb-1">Internal Notes</label>
                      <textarea
                        rows={3}
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        placeholder="Add integration details or reseller identifiers..."
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 bg-[#1C1917] hover:bg-stone-800 text-white font-bold uppercase tracking-wider rounded-xl transition-all shadow-md mt-2"
                    >
                      {isLoading ? 'Processing Ingress...' : 'Generate Secure Key'}
                    </button>
                  </form>

                  {/* Golden Created Key Banner */}
                  {newlyCreatedLicense && (
                    <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 mt-2 flex flex-col gap-2.5 animate-bounce-horizontal">
                      <div className="flex items-center gap-1.5 text-amber-950 font-bold text-[11px] uppercase tracking-wider">
                        <Key className="w-3.5 h-3.5 text-amber-500" />
                        <span>Production Key Generated</span>
                      </div>
                      <div className="bg-stone-900 rounded-lg p-3 text-center flex items-center justify-between gap-3 border border-stone-800 shadow-inner">
                        <span className="font-mono text-xs font-black tracking-widest text-amber-400 break-all select-all">
                          {newlyCreatedLicense.key}
                        </span>
                        <button
                          onClick={() => handleCopy(newlyCreatedLicense.key)}
                          className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded transition-colors"
                          title="Copy generated license"
                        >
                          {copiedKey === newlyCreatedLicense.key ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <span className="text-[10px] text-stone-500 italic text-center">Give this credential to your client. They can use it to register active stations.</span>
                    </div>
                  )}

                </div>
              )}

              {/* Edit Modal (Overlaid inside column when editing) */}
              {editingLicense && (
                <div id="edit-license-overlay" className="lg:col-span-4 bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5 animate-slide-in">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <span className="text-xs font-bold text-[#1C1917] uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-blue-600" />
                      <span>Adjust Key Properties</span>
                    </span>
                    <button 
                      onClick={() => setEditingLicense(null)} 
                      className="text-stone-400 hover:text-stone-600 text-xs uppercase font-bold"
                    >
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleUpdateLicense} className="flex flex-col gap-4 text-xs">
                    <div>
                      <span className="block font-bold text-stone-400 uppercase tracking-widest mb-1">Target Account</span>
                      <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                        <p className="font-bold text-[#1C1917]">{editingLicense.clientName}</p>
                        <p className="font-mono text-[10px] text-stone-500 mt-0.5">{editingLicense.key}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-stone-600 uppercase tracking-wider mb-1">Administrative Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as any)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                      >
                        <option value="active">Active (Permit verification)</option>
                        <option value="suspended">Suspended (Reject verification)</option>
                        <option value="expired">Expired (Block updates)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-stone-600 uppercase tracking-wider mb-1">Hardware Limits</label>
                        <input
                          type="number"
                          value={editMaxDevices}
                          onChange={(e) => setEditMaxDevices(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-900 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-stone-600 uppercase tracking-wider mb-1">Expiration Date</label>
                        <input
                          type="datetime-local"
                          value={editExpiresAt}
                          onChange={(e) => setEditExpiresAt(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-900 focus:outline-none text-[10px]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-stone-600 uppercase tracking-wider mb-1">Admin Logs / Internal Notes</label>
                      <textarea
                        rows={3}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white resize-none"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingLicense(null)}
                        className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold uppercase tracking-wider rounded-xl transition-all text-center"
                      >
                        Discard
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-3 bg-[#1C1917] hover:bg-stone-800 text-white font-bold uppercase tracking-wider rounded-xl transition-all text-center"
                      >
                        Save Adjustments
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Master Licenses Table List (Span 8 if side form open, else Span 12) */}
              <div className={`flex flex-col gap-4 bg-white border border-stone-200 rounded-2xl p-6 shadow-sm 
                ${(isCreateOpen || editingLicense) ? 'lg:col-span-8' : 'lg:col-span-12'}`}
              >
                
                {/* Filters, search, and indicators bar */}
                <div id="table-controls" className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 border-b border-stone-100 pb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      id="registry-search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search licenses by key, customer name, email or notes..."
                      className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                    <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl">
                      <Filter className="w-3.5 h-3.5 text-stone-400" />
                      <select
                        value={tierFilter}
                        onChange={(e) => setTierFilter(e.target.value)}
                        className="bg-transparent text-xs text-stone-700 font-medium outline-none"
                      >
                        <option value="all">All Tiers</option>
                        <option value="standard">Standard</option>
                        <option value="premium">Premium</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl">
                      <Sliders className="w-3.5 h-3.5 text-stone-400" />
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-transparent text-xs text-stone-700 font-medium outline-none"
                      >
                        <option value="all">All Statuses</option>
                        <option value="active">Active Only</option>
                        <option value="suspended">Suspended Only</option>
                        <option value="expired">Expired Only</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Desktop and Mobile list rendering */}
                <div className="overflow-x-auto">
                  {filteredLicenses.length === 0 ? (
                    <div className="text-center py-16 flex flex-col items-center justify-center gap-3">
                      <Key className="w-8 h-8 text-stone-300" />
                      <p className="text-xs text-stone-500 italic">No license keys found matching your filter constraints.</p>
                      <button 
                        onClick={() => { setSearchQuery(''); setTierFilter('all'); setStatusFilter('all'); }}
                        className="text-xs text-amber-600 font-bold hover:underline"
                      >
                        Clear Active Filters
                      </button>
                    </div>
                  ) : (
                    <table id="licenses-data-table" className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-100 text-[10px] font-bold text-stone-400 uppercase tracking-widest bg-stone-50/50">
                          <th className="py-3 px-4">Client Detail / Email</th>
                          <th className="py-3 px-4">License Key</th>
                          <th className="py-3 px-4">Tier / Level</th>
                          <th className="py-3 px-4 text-center">Stations</th>
                          <th className="py-3 px-4">Expiration Lifespan</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLicenses.map(lic => {
                          const isExpired = lic.expiresAt !== 'never' && new Date(lic.expiresAt).getTime() < Date.now();
                          const currentStatus = isExpired ? 'expired' : lic.status;

                          return (
                            <tr 
                              key={lic.id} 
                              id={`lic-row-${lic.id}`}
                              className="border-b border-stone-100 text-xs hover:bg-stone-50/50 transition-colors"
                            >
                              <td className="py-3.5 px-4 max-w-[200px]">
                                <p className="font-bold text-[#1C1917] truncate" title={lic.clientName}>{lic.clientName}</p>
                                <p className="text-[10px] text-stone-400 truncate mt-0.5" title={lic.clientEmail}>{lic.clientEmail}</p>
                              </td>
                              
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2 font-mono text-[11px] font-semibold text-[#1C1917]">
                                  <span className="bg-stone-100 px-2 py-1 rounded select-all font-mono break-all tracking-wider">
                                    {lic.key}
                                  </span>
                                  <button
                                    onClick={() => handleCopy(lic.key)}
                                    className="p-1 text-stone-300 hover:text-stone-600 transition-colors flex-shrink-0"
                                    title="Copy license key to clipboard"
                                  >
                                    {copiedKey === lic.key ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                                {lic.notes && (
                                  <p className="text-[10px] text-stone-400 italic max-w-[180px] truncate mt-1">
                                    Notes: {lic.notes}
                                  </p>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider
                                  ${lic.tier === 'standard' ? 'bg-stone-100 text-stone-700 border border-stone-200' : ''}
                                  ${lic.tier === 'premium' ? 'bg-blue-50 text-blue-700 border border-blue-100' : ''}
                                  ${lic.tier === 'enterprise' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : ''}
                                `}>
                                  {lic.tier}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                <div className="flex flex-col items-center">
                                  <span className="font-mono font-bold text-[#1C1917]">
                                    {lic.activatedDevices.length} / {lic.maxDevices === 0 ? '∞' : lic.maxDevices}
                                  </span>
                                  <div className="w-16 h-1 bg-stone-100 rounded-full mt-1.5 overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${
                                        lic.maxDevices > 0 && lic.activatedDevices.length >= lic.maxDevices 
                                          ? 'bg-amber-500' 
                                          : 'bg-indigo-600'
                                      }`}
                                      style={{ 
                                        width: lic.maxDevices === 0 
                                          ? '50%' 
                                          : `${Math.min(100, (lic.activatedDevices.length / lic.maxDevices) * 100)}%` 
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-mono text-stone-500 text-[10px]">
                                {lic.expiresAt === 'never' ? (
                                  <span className="text-stone-400 uppercase tracking-widest font-sans font-bold text-[9px]">Perpetual</span>
                                ) : (
                                  <span>{new Date(lic.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                                  ${currentStatus === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : ''}
                                  ${currentStatus === 'suspended' ? 'bg-red-50 text-red-700 border border-red-100' : ''}
                                  ${currentStatus === 'expired' ? 'bg-amber-50 text-amber-700 border border-amber-100' : ''}
                                `}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    currentStatus === 'active' ? 'bg-emerald-500 animate-pulse' :
                                    currentStatus === 'suspended' ? 'bg-red-500' : 'bg-amber-500'
                                  }`}></span>
                                  {currentStatus}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2.5">
                                  <button
                                    onClick={() => {
                                      setTesterKey(lic.key);
                                      setActiveTab('tester');
                                    }}
                                    className="p-1 text-stone-400 hover:text-amber-500 transition-all font-bold uppercase text-[10px]"
                                    title="Send key directly to integration playground tester"
                                  >
                                    Test
                                  </button>
                                  <button
                                    onClick={() => openEditModal(lic)}
                                    className="p-1 text-stone-400 hover:text-blue-500 transition-all font-bold uppercase text-[10px]"
                                    title="Modify Key Properties"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleResetActivations(lic.id, lic.clientName)}
                                    disabled={lic.activatedDevices.length === 0}
                                    className={`p-1 font-bold uppercase text-[10px] transition-all
                                      ${lic.activatedDevices.length === 0 
                                        ? 'text-stone-200 cursor-not-allowed' 
                                        : 'text-stone-400 hover:text-indigo-500'
                                      }`}
                                    title="Reset hardware activation register list"
                                  >
                                    Reset
                                  </button>
                                  <button
                                    onClick={() => handleRevokeLicense(lic.id, lic.clientName)}
                                    className="p-1 text-stone-300 hover:text-red-500 transition-all"
                                    title="Revoke License permanently"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="bg-stone-50 border border-stone-200 p-4 rounded-xl text-[11px] text-stone-500 flex items-start gap-2.5 mt-2">
                  <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5 animate-bounce-horizontal" />
                  <div>
                    <p className="font-bold text-[#1C1917] mb-0.5">Hardware Verification Architecture</p>
                    <p>Clients running the EPG-PRO suite periodically invoke `/api/licenses/validate` to verify validity. Keys are limited to maximum device slots. When slot counts are full, new installations are locked until an administrator runs a <strong>Reset Activations</strong> audit event above.</p>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: INTEGRATION TESTER PLAYGROUND */}
          {activeTab === 'tester' && (
            <div id="integration-tester-view" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Emulator Console */}
              <div className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
                <div>
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Interactive Client Emulator</h3>
                  <p className="text-[11px] text-stone-500">Test how the EPG-PRO system validates client installations against your keys.</p>
                </div>

                <form onSubmit={handleTestAPI} className="flex flex-col gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-stone-600 uppercase tracking-wider mb-1">Target License Key</label>
                    <input
                      type="text"
                      required
                      value={testerKey}
                      onChange={(e) => setTesterKey(e.target.value)}
                      placeholder="EPGPRO-XXXX-XXXX-XXXX-XXXX"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-900 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white text-xs tracking-wider"
                    />
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] text-stone-400 self-center">Presets:</span>
                      {licenses.slice(0, 3).map(lic => (
                        <button
                          key={lic.id}
                          type="button"
                          onClick={() => setTesterKey(lic.key)}
                          className="bg-stone-100 hover:bg-stone-200 border border-stone-200 text-[10px] font-mono px-2 py-0.5 rounded text-stone-700"
                        >
                          {lic.clientName.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-stone-600 uppercase tracking-wider">Device / Hardware ID</label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-stone-400 hover:text-stone-600">
                        <input
                          type="checkbox"
                          checked={testerRegister}
                          onChange={(e) => setTesterRegister(e.target.checked)}
                          className="rounded border-stone-300 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-[10px] uppercase font-bold tracking-wider select-none">Send Hardware ID</span>
                      </label>
                    </div>

                    <input
                      type="text"
                      disabled={!testerRegister}
                      value={testerDeviceId}
                      onChange={(e) => setTesterDeviceId(e.target.value)}
                      placeholder="e.g. windows_station_nyc_2"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-900 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white disabled:opacity-40"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isTesting || !testerKey.trim()}
                    className="w-full py-3 bg-[#1C1917] hover:bg-stone-800 text-white font-bold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    {isTesting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-amber-500 rounded-full animate-spin"></span>
                        <span>Verifying Session...</span>
                      </>
                    ) : (
                      <>
                        <Terminal className="w-4 h-4 text-amber-500" />
                        <span>Perform API Verification Match</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="border-t border-stone-100 pt-4 flex flex-col gap-2">
                  <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Validation API Info</h4>
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-[11px] text-stone-600 font-mono">
                    <p className="font-semibold text-stone-800 mb-1 flex items-center justify-between">
                      <span>HTTP Method: POST</span>
                      <span className="text-amber-600">application/json</span>
                    </p>
                    <p className="break-all text-[10px] text-stone-500">
                      URL: {window.location.origin}/api/licenses/validate
                    </p>
                  </div>
                </div>

              </div>

              {/* Right Column: Emulator Response & Code Snippets */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                
                {/* Simulated API Output Panel */}
                <div className="bg-stone-900 text-stone-100 border border-stone-800 rounded-2xl p-6 shadow-xl font-mono flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-stone-800 pb-3">
                    <span className="text-[10px] font-bold uppercase text-stone-400 tracking-wider flex items-center gap-2">
                      <Code className="w-4 h-4 text-emerald-400" />
                      <span>EPG Client Stream Logger</span>
                    </span>
                    {testerStatus && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono
                        ${testerStatus === 200 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        HTTP STATUS: {testerStatus}
                      </span>
                    )}
                  </div>

                  <div className="text-xs bg-stone-950 p-4 rounded-xl border border-stone-800 shadow-inner min-h-[160px] overflow-auto">
                    {testerResponse ? (
                      <pre className="text-stone-300 leading-relaxed font-mono">
                        {JSON.stringify(testerResponse, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-stone-500 text-center py-12 flex flex-col items-center justify-center gap-2">
                        <Terminal className="w-6 h-6 text-stone-700 animate-pulse" />
                        <p className="italic">Waiting for simulated activation request payload...</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Developer Integration Code Blocks */}
                <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                  <div>
                    <h3 className="text-xs font-bold text-[#1C1917] uppercase tracking-widest mb-1">Direct Application Integration</h3>
                    <p className="text-[11px] text-stone-500">Inject these pre-made boilerplate request methods directly into your application to check licenses at boot-time.</p>
                  </div>

                  <div className="flex gap-2.5">
                    {(['curl', 'js', 'python'] as const).map(lang => (
                      <button
                        key={lang}
                        onClick={() => copySnippet(lang)}
                        className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 uppercase tracking-wide transition-all"
                      >
                        {lang === 'curl' ? 'cURL Command' : lang === 'js' ? 'JS / Fetch' : 'Python requests'}
                      </button>
                    ))}
                  </div>

                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-[10px] text-stone-500 italic">
                    All integration snippets communicate using strict validation standards, ensuring that offline activations and machine limits are safely authorized prior to playing the main IPTV Streams.
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 3: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div id="audit-logs-view" className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              
              <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 border-b border-stone-100 pb-4">
                <div>
                  <h3 className="text-xs font-bold text-[#1C1917] uppercase tracking-widest mb-1">Server Registry Audit Trails</h3>
                  <p className="text-[11px] text-stone-500">Real-time log of license verifications, hardware activations, and administrator updates.</p>
                </div>

                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    id="logs-search"
                    value={logsSearch}
                    onChange={(e) => setLogsSearch(e.target.value)}
                    placeholder="Search logs by key, client name, device, IP..."
                    className="w-full pl-9 pr-4 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-16 flex flex-col items-center justify-center gap-3">
                    <Activity className="w-8 h-8 text-stone-300 animate-pulse" />
                    <p className="text-xs text-stone-500 italic">No historical logs found matching your criteria.</p>
                  </div>
                ) : (
                  <table id="logs-data-table" className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-stone-100 text-[10px] font-bold text-stone-400 uppercase tracking-widest bg-stone-50/50">
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">License Key / Account</th>
                        <th className="py-2.5 px-3">Action Type</th>
                        <th className="py-2.5 px-3">Device Target ID</th>
                        <th className="py-2.5 px-3">Caller IP Address</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">System Statement / Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map(log => (
                        <tr 
                          key={log.id} 
                          id={`log-row-${log.id}`}
                          className="border-b border-stone-100 text-[11px] hover:bg-stone-50/50 transition-colors"
                        >
                          <td className="py-3 px-3 font-mono text-stone-400 text-[10px] whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>

                          <td className="py-3 px-3">
                            <p className="font-bold text-[#1C1917] truncate max-w-[150px]" title={log.clientName}>{log.clientName}</p>
                            <p className="font-mono text-[9px] text-stone-400 mt-0.5 truncate max-w-[150px]" title={log.licenseKey}>{log.licenseKey}</p>
                          </td>

                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide
                              ${log.action === 'validate' ? 'bg-blue-50 text-blue-700' : ''}
                              ${log.action === 'activate' ? 'bg-emerald-50 text-emerald-700 font-bold' : ''}
                              ${log.action === 'deactivate' ? 'bg-stone-100 text-stone-700' : ''}
                              ${log.action === 'failed_validation' ? 'bg-red-50 text-red-700 font-bold' : ''}
                            `}>
                              {log.action}
                            </span>
                          </td>

                          <td className="py-3 px-3 font-mono text-stone-600">
                            {log.deviceId || <span className="text-stone-300">-</span>}
                          </td>

                          <td className="py-3 px-3 font-mono text-stone-500 text-[10px]">
                            {log.ipAddress || <span className="text-stone-300">-</span>}
                          </td>

                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 font-bold uppercase text-[9px]
                              ${log.status === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                              {log.status === 'success' ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                              <span>{log.status}</span>
                            </span>
                          </td>

                          <td className="py-3 px-3 text-stone-600 max-w-[280px] truncate" title={log.reason}>
                            {log.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          )}

        </section>

      </main>

      {/* Footer copyright */}
      <footer id="licensing-footer" className="border-t border-stone-200 bg-white py-6 mt-12 text-center text-xs text-stone-500 font-medium uppercase tracking-wider">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-3">
          <p>© 2026 EPG-PRO Ltd. All rights reserved.</p>
          <div className="flex gap-4 text-[10px] text-stone-400 font-bold">
            <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 text-amber-500" /> SECURE JSON STORE</span>
            <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-amber-500" /> API VERSION V2</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
