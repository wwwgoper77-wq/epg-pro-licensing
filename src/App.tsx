import React, { useState, useEffect } from "react";
import { 
  Key, Plus, Search, Trash2, RefreshCw, CheckCircle, XCircle, 
  Tv, Calendar, Shield, Activity, FileText, Layers, AlertCircle, ToggleLeft, ToggleRight
} from "lucide-react";

interface License {
  key: string;
  tier: "Free" | "Premium" | "Ultimate";
  maxDevices: number;
  activatedDevices: string[];
  expiresAt: string;
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

export default function App() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [logs, setLogs] = useState<ActivationLog[]>([]);
  const [loadingLicenses, setLoadingLicenses] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"licenses" | "logs">("licenses");
  const [error, setError] = useState<string | null>(null);

  // New License Form State
  const [newKey, setNewKey] = useState("");
  const [newTier, setNewTier] = useState<"Free" | "Premium" | "Ultimate">("Premium");
  const [newMaxDevices, setNewMaxDevices] = useState(1);
  const [newExpiresAt, setNewExpiresAt] = useState("");

  const fetchLicenses = async () => {
    try {
      setLoadingLicenses(true);
      const res = await fetch("/api/admin/licenses");
      if (!res.ok) throw new Error("Failed to fetch licenses");
      const data = await res.json();
      setLicenses(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoadingLicenses(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await fetch("/api/admin/logs");
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      setLogs(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
    fetchLogs();
    
    // Set default expiration date to 1 year from now
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setNewExpiresAt(nextYear.toISOString().split("T")[0]);
  }, []);

  const generateRandomKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key = "EPG-PRO-";
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (i < 3) key += "-";
    }
    setNewKey(key);
  };

  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey) {
      setError("Please generate or enter a license key");
      return;
    }

    try {
      const res = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newKey,
          tier: newTier,
          maxDevices: newMaxDevices,
          expiresAt: newExpiresAt,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create license");
      }

      setNewKey("");
      generateRandomKey();
      fetchLicenses();
      fetchLogs();
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to create license");
    }
  };

  const handleToggleLicense = async (key: string) => {
    try {
      const res = await fetch(`/api/admin/licenses/${key}/toggle`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to toggle license state");
      fetchLicenses();
      fetchLogs();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteLicense = async (key: string) => {
    if (!confirm(`Are you sure you want to delete license ${key}?`)) return;
    try {
      const res = await fetch(`/api/admin/licenses/${key}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete license");
      fetchLicenses();
      fetchLogs();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredLicenses = licenses.filter(
    (lic) =>
      lic.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lic.tier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lic.activatedDevices.some((dev) => dev.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans" id="licensing-root">
      {/* Header bar */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">Arabic EPG Translator Pro</h1>
              <p className="text-xs text-slate-400">Commercial Licensing & Management Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { fetchLicenses(); fetchLogs(); }}
              className="p-2 text-slate-400 hover:text-slate-100 transition-colors bg-slate-900 border border-slate-800 rounded-lg"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="text-right">
              <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                License Server Online
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Error alert */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-xs text-rose-400 hover:text-rose-200">Dismiss</button>
          </div>
        )}

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-400">Total Keys</span>
              <Key className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-3xl font-bold text-slate-100">{licenses.length}</p>
            <p className="text-xs text-slate-500 mt-2">Active in translator server</p>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-400">Total Activated Devices</span>
              <Tv className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-3xl font-bold text-slate-100">
              {licenses.reduce((acc, curr) => acc + curr.activatedDevices.length, 0)}
            </p>
            <p className="text-xs text-slate-500 mt-2">Enigma2 receiver devices</p>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-400">Ultimate Tiers</span>
              <Layers className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-slate-100">
              {licenses.filter(l => l.tier === "Ultimate").length}
            </p>
            <p className="text-xs text-slate-500 mt-2">Premium commercial keys</p>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-400">Active Rate</span>
              <Activity className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-slate-100">
              {licenses.length > 0 ? Math.round((licenses.filter(l => l.active).length / licenses.length) * 100) : 0}%
            </p>
            <p className="text-xs text-slate-500 mt-2">Of total licenses enabled</p>
          </div>
        </section>

        {/* Dynamic content split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left panel: Quick Actions / Key generator */}
          <section className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Generate License Key
              </h2>

              <form onSubmit={handleCreateLicense} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    License Key
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                      placeholder="EPG-PRO-XXXX-XXXX-XXXX"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <button 
                      type="button"
                      onClick={generateRandomKey}
                      className="px-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold hover:text-slate-200 transition-colors"
                    >
                      Gen
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Tier
                    </label>
                    <select 
                      value={newTier}
                      onChange={(e) => setNewTier(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none"
                    >
                      <option value="Premium">Premium</option>
                      <option value="Ultimate">Ultimate</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Device Limit
                    </label>
                    <input 
                      type="number" 
                      min="1" 
                      max="100"
                      value={newMaxDevices}
                      onChange={(e) => setNewMaxDevices(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Expiration Date
                  </label>
                  <input 
                    type="date" 
                    value={newExpiresAt}
                    onChange={(e) => setNewExpiresAt(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none"
                    required
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm transition-colors mt-2"
                >
                  Create License Key
                </button>
              </form>
            </div>

            {/* Quick deployment instructions card */}
            <div className="bg-slate-950/20 border border-slate-800/80 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-slate-200 mb-2">Direct Enigma2 Install</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                To install this plugin on your OpenATV, Egami or OpenPLi receiver, copy the plugin files into <code>/usr/lib/enigma2/python/Plugins/Extensions/ArabicEPGTranslator/</code> and run the installer.
              </p>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] font-mono text-emerald-400 break-all block">
                  sh install.sh
                </span>
              </div>
            </div>
          </section>

          {/* Right panel: Main tables */}
          <section className="lg:col-span-2">
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-full min-h-[500px]">
              
              {/* Tab selector */}
              <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-950/20">
                <div className="flex gap-2">
                  <button 
                    onClick={() => setActiveTab("licenses")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                      activeTab === "licenses" 
                        ? "bg-slate-800 text-slate-100" 
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Key className="w-4 h-4" />
                    Licenses
                  </button>
                  <button 
                    onClick={() => setActiveTab("logs")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                      activeTab === "logs" 
                        ? "bg-slate-800 text-slate-100" 
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Activation Logs
                  </button>
                </div>

                {activeTab === "licenses" && (
                  <div className="relative w-48 md:w-64">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Search licenses..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Licenses Tab content */}
              {activeTab === "licenses" && (
                <div className="flex-1 overflow-x-auto">
                  {loadingLicenses ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                      <RefreshCw className="w-8 h-8 animate-spin" />
                      <p className="text-sm">Loading licensing database...</p>
                    </div>
                  ) : filteredLicenses.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                      <p className="text-sm">No licenses found matching your query.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/25 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="px-6 py-4">License Key</th>
                          <th className="px-6 py-4">Tier</th>
                          <th className="px-6 py-4">Devices</th>
                          <th className="px-6 py-4">Expires At</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-sm">
                        {filteredLicenses.map((lic) => {
                          const isExpired = new Date(lic.expiresAt) < new Date();
                          return (
                            <tr key={lic.key} className="hover:bg-slate-900/30 transition-colors">
                              <td className="px-6 py-4 font-mono font-medium text-slate-200">
                                {lic.key}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  lic.tier === "Ultimate" 
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                }`}>
                                  {lic.tier}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-slate-300 font-medium">
                                    {lic.activatedDevices.length} / {lic.maxDevices}
                                  </span>
                                  {lic.activatedDevices.length > 0 && (
                                    <span className="text-[10px] text-slate-500 font-mono block max-w-[120px] truncate">
                                      {lic.activatedDevices.join(", ")}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 font-mono text-xs">
                                <span className={isExpired ? "text-rose-400" : "text-slate-400"}>
                                  {lic.expiresAt}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <button 
                                  onClick={() => handleToggleLicense(lic.key)}
                                  className="focus:outline-none"
                                >
                                  {lic.active && !isExpired ? (
                                    <span className="text-emerald-400 flex items-center gap-1 text-xs">
                                      <CheckCircle className="w-4 h-4" />
                                      Active
                                    </span>
                                  ) : isExpired ? (
                                    <span className="text-rose-400 flex items-center gap-1 text-xs">
                                      <XCircle className="w-4 h-4" />
                                      Expired
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 flex items-center gap-1 text-xs">
                                      <XCircle className="w-4 h-4" />
                                      Disabled
                                    </span>
                                  )}
                                </button>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => handleToggleLicense(lic.key)}
                                    className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                                    title={lic.active ? "Deactivate License" : "Activate License"}
                                  >
                                    {lic.active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteLicense(lic.key)}
                                    className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                                    title="Delete Key"
                                  >
                                    <Trash2 className="w-4 h-4" />
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
              )}

              {/* Activation Logs Tab Content */}
              {activeTab === "logs" && (
                <div className="flex-1 overflow-x-auto">
                  {loadingLogs ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                      <RefreshCw className="w-8 h-8 animate-spin" />
                      <p className="text-sm">Loading activity logs...</p>
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                      <p className="text-sm">No activity has been logged yet.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/25 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="px-6 py-4">Timestamp</th>
                          <th className="px-6 py-4">License Key</th>
                          <th className="px-6 py-4">Hardware ID</th>
                          <th className="px-6 py-4">Action</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">IP Address</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-sm font-mono">
                        {logs.map((log, index) => (
                          <tr key={index} className="hover:bg-slate-900/30 transition-colors">
                            <td className="px-6 py-4 text-xs text-slate-400">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 font-bold text-xs text-slate-300">
                              {log.key || "N/A"}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">
                              {log.hwid || "N/A"}
                            </td>
                            <td className="px-6 py-4 text-xs">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                log.action === "activate" 
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs">
                              <span className={log.status === "Success" || log.status === "Verified" ? "text-emerald-400 font-bold" : "text-rose-400"}>
                                {log.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500">
                              {log.ip}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
