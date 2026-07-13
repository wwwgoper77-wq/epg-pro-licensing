import React, { useState, useEffect } from "react";
import { 
  Key, 
  Shield, 
  Cpu, 
  Calendar, 
  RefreshCw, 
  Trash2, 
  Ban, 
  CheckCircle, 
  Copy, 
  Check, 
  Download, 
  Terminal, 
  Layers, 
  UserCheck, 
  FileCode, 
  Activity, 
  Lock, 
  LogOut, 
  PlusCircle, 
  Search, 
  AlertCircle,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string>("");

  // Dashboard active tab
  const [activeTab, setActiveTab] = useState<"licenses" | "logs" | "client">("licenses");

  // Server data states
  const [licenses, setLicenses] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Form states for key creation
  const [newKeyType, setNewKeyType] = useState<string>("lifetime");
  const [newKeyNotes, setNewKeyNotes] = useState<string>("");
  const [newKeyCount, setNewKeyCount] = useState<number>(1);
  const [generating, setGenerating] = useState<boolean>(false);

  // File viewer state (Download center)
  const [selectedFile, setSelectedFile] = useState<string>("plugin.py");
  const [fileContent, setFileContent] = useState<string>("");
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // Copy feedback tracking
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Status Alerts
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // On mount: check local storage token
  useEffect(() => {
    const savedToken = localStorage.getItem("epg_admin_token");
    if (savedToken) {
      setToken(savedToken);
      setIsLoggedIn(true);
    }
  }, []);

  // Fetch licenses and logs when logged in
  useEffect(() => {
    if (isLoggedIn && token) {
      fetchDashboardData();
    }
  }, [isLoggedIn, token]);

  // Fetch client files for code viewer
  useEffect(() => {
    if (isLoggedIn && activeTab === "client") {
      fetchClientFile(selectedFile);
    }
  }, [activeTab, selectedFile, isLoggedIn]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/data", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setLicenses(data.licenses || []);
        setLogs(data.activation_logs || []);
      } else if (response.status === 401) {
        // Token expired or invalid
        handleLogout();
      }
    } catch (e) {
      showTemporaryAlert("error", "Unable to load licensing data from backend.");
    } finally {
      setLoading(false);
    }
  };

  const fetchClientFile = async (filename: string) => {
    setLoadingFile(true);
    try {
      const response = await fetch(`/api/download/raw/${filename}`);
      if (response.ok) {
        const text = await response.text();
        setFileContent(text);
      } else {
        setFileContent(`# Error loading source code for ${filename}`);
      }
    } catch (e) {
      setFileContent(`# Network error loading ${filename}`);
    } finally {
      setLoadingFile(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem("epg_admin_token", data.token);
        setToken(data.token);
        setIsLoggedIn(true);
        setUsername("");
        setPassword("");
      } else {
        setAuthError(data.error || "Login failed.");
      }
    } catch (err) {
      setAuthError("Server unavailable. Please verify backend is running.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("epg_admin_token");
    setToken(null);
    setIsLoggedIn(false);
    setLicenses([]);
    setLogs([]);
  };

  const handleGenerateKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const response = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          type: newKeyType,
          notes: newKeyNotes,
          count: newKeyCount
        })
      });
      const data = await response.json();
      if (data.success) {
        showTemporaryAlert("success", data.message);
        setNewKeyNotes("");
        setNewKeyCount(1);
        fetchDashboardData();
      } else {
        showTemporaryAlert("error", data.error || "Failed to generate keys.");
      }
    } catch (e) {
      showTemporaryAlert("error", "Key generation server timed out.");
    } finally {
      setGenerating(false);
    }
  };

  // Action methods
  const handleResetHWID = async (key: string) => {
    if (!confirm(`Are you sure you want to unbind and reset the receiver HWID for license ${key}? This allows installation on a new box.`)) return;
    try {
      const response = await fetch("/api/admin/licenses/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ key })
      });
      const data = await response.json();
      if (data.success) {
        showTemporaryAlert("success", data.message);
        fetchDashboardData();
      } else {
        showTemporaryAlert("error", data.error);
      }
    } catch (e) {
      showTemporaryAlert("error", "Action failed.");
    }
  };

  const handleRevokeLicense = async (key: string) => {
    if (!confirm(`WARNING: Are you sure you want to revoke license ${key}? This will instantly block translation capabilities on the receiver box.`)) return;
    try {
      const response = await fetch("/api/admin/licenses/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ key })
      });
      const data = await response.json();
      if (data.success) {
        showTemporaryAlert("success", data.message);
        fetchDashboardData();
      } else {
        showTemporaryAlert("error", data.error);
      }
    } catch (e) {
      showTemporaryAlert("error", "Action failed.");
    }
  };

  const handleEnableLicense = async (key: string) => {
    try {
      const response = await fetch("/api/admin/licenses/enable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ key })
      });
      const data = await response.json();
      if (data.success) {
        showTemporaryAlert("success", data.message);
        fetchDashboardData();
      } else {
        showTemporaryAlert("error", data.error);
      }
    } catch (e) {
      showTemporaryAlert("error", "Action failed.");
    }
  };

  const handleDeleteLicense = async (key: string) => {
    if (!confirm(`CRITICAL: Delete license ${key} permanently from the licensing server? This action is irreversible.`)) return;
    try {
      const response = await fetch("/api/admin/licenses/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ key })
      });
      const data = await response.json();
      if (data.success) {
        showTemporaryAlert("success", data.message);
        fetchDashboardData();
      } else {
        showTemporaryAlert("error", data.error);
      }
    } catch (e) {
      showTemporaryAlert("error", "Action failed.");
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("Wipe all historical activation logs from database?")) return;
    try {
      const response = await fetch("/api/admin/logs/clear", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        showTemporaryAlert("success", data.message);
        fetchDashboardData();
      }
    } catch (e) {
      showTemporaryAlert("error", "Failed to clear logs.");
    }
  };

  const triggerClipboardCopy = (text: string, isCode = false) => {
    navigator.clipboard.writeText(text);
    if (isCode) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedKey(text);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const showTemporaryAlert = (type: "success" | "error", text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => {
      setAlertMsg(null);
    }, 5000);
  };

  // Filter licenses by search query
  const filteredLicenses = licenses.filter(lic => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      lic.key.toLowerCase().includes(query) ||
      (lic.hwid && lic.hwid.toLowerCase().includes(query)) ||
      (lic.notes && lic.notes.toLowerCase().includes(query)) ||
      lic.type.toLowerCase().includes(query) ||
      lic.status.toLowerCase().includes(query)
    );
  });

  // Calculate statistics
  const totalKeysCount = licenses.length;
  const activeBoundCount = licenses.filter(l => l.hwid !== null && l.status === "Active").length;
  const pendingKeysCount = licenses.filter(l => l.status === "Inactive").length;
  const expiredCount = licenses.filter(l => l.status === "Expired").length;
  const revokedCount = licenses.filter(l => l.status === "Revoked").length;

  // Format Iso Date
  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return "N/A";
    if (isoStr === "lifetime") return "Lifetime (Never)";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  // Helper for status badge style
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>;
      case "Inactive":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">Inactive</span>;
      case "Expired":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Expired</span>;
      case "Revoked":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">Revoked</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">{status}</span>;
    }
  };

  // Helper for action tags in logs
  const getLogActionBadge = (action: string) => {
    switch (action) {
      case "activate_success":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">ACTIVATED</span>;
      case "verify_success":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">VERIFIED</span>;
      case "failed_invalid_key":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">INVALID_KEY</span>;
      case "failed_hwid_mismatch":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">HWID_MISMATCH</span>;
      case "failed_revoked":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">BLOCKED_REVOKED</span>;
      case "admin_revoked":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">ADMIN_REVOKE</span>;
      case "admin_enabled":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">ADMIN_ENABLE</span>;
      case "admin_hwid_reset":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">HWID_RESET</span>;
      case "admin_deleted":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">ADMIN_DELETE</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-zinc-500/20 text-zinc-300 border border-zinc-500/30">{action.toUpperCase()}</span>;
    }
  };

  // Render Login state if not authenticated
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 selection:bg-cyan-500 selection:text-black">
        {/* Abstract Background Design */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.03),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.03),transparent_40%)]" />

        <div className="w-full max-w-md relative">
          {/* Dashboard Header */}
          <div className="text-center mb-8">
            <div className="inline-flex p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-2xl text-cyan-400 mb-4 shadow-lg shadow-cyan-950/20">
              <Shield className="w-8 h-8 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              EPG-PRO Licensing Server
            </h1>
            <p className="text-sm text-zinc-400 mt-2">
              Arabic EPG Translator Commercial Control Center
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500" />
            
            <h2 className="text-lg font-medium text-white mb-6">Administrator Portal</h2>
            
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-2">
                  Admin Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter administrator username"
                    className="block w-full pl-10 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-2">
                  Secure Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {authError && (
                <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-semibold text-sm rounded-xl cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-cyan-500/10"
              >
                <Shield className="w-4 h-4" />
                Authenticate Session
              </button>
            </form>

            {/* Quick Demo Info */}
            <div className="mt-6 pt-5 border-t border-zinc-800/80 text-center">
              <p className="text-xs text-zinc-500">
                Default Credentials: <span className="text-zinc-300 font-mono">admin</span> / <span className="text-zinc-300 font-mono">admin</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Dynamic Alert Banner */}
      <AnimatePresence>
        {alertMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-xl text-sm ${
              alertMsg.type === "success" 
                ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/40" 
                : "bg-rose-950/90 text-rose-300 border-rose-500/40"
            }`}
          >
            {alertMsg.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{alertMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-950 border border-cyan-500/30 text-cyan-400 rounded-xl">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">EPG-PRO Server</h1>
              <span className="text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded">ADMIN v2.1</span>
            </div>
            <p className="text-xs text-zinc-400">Arabic EPG Translator licensing & customer controller</p>
          </div>
        </div>

        {/* Header Tabs */}
        <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTab("licenses")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg cursor-pointer transition-all ${
              activeTab === "licenses" 
                ? "bg-cyan-600 text-zinc-950 font-semibold" 
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            Licenses Management
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg cursor-pointer transition-all ${
              activeTab === "logs" 
                ? "bg-cyan-600 text-zinc-950 font-semibold" 
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Activation Logs
            {logs.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("client")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg cursor-pointer transition-all ${
              activeTab === "client" 
                ? "bg-cyan-600 text-zinc-950 font-semibold" 
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Client Download Centre
          </button>
        </div>

        {/* Profile/Logout */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-white">Administrator</p>
            <p className="text-[10px] text-zinc-500">Authorized Session</p>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-2 bg-zinc-950 hover:bg-rose-950/20 text-zinc-400 hover:text-rose-400 rounded-xl border border-zinc-850 cursor-pointer transition-all active:scale-95"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Admin Area Grid */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        
        {/* Statistics Cards Rows */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-cyan-950/50 text-cyan-400 border border-cyan-500/20 rounded-lg">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Total Keys</p>
              <h3 className="text-xl font-bold text-white font-mono">{totalKeysCount}</h3>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-950/50 text-emerald-400 border border-emerald-500/20 rounded-lg">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Active Bound</p>
              <h3 className="text-xl font-bold text-white font-mono">{activeBoundCount}</h3>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-950/50 text-blue-400 border border-blue-500/20 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Pending Activation</p>
              <h3 className="text-xl font-bold text-white font-mono">{pendingKeysCount}</h3>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-950/50 text-amber-400 border border-amber-500/20 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Expired Keys</p>
              <h3 className="text-xl font-bold text-white font-mono">{expiredCount}</h3>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-4 flex items-center gap-3 col-span-2 lg:col-span-1">
            <div className="p-2.5 bg-rose-950/50 text-rose-400 border border-rose-500/20 rounded-lg">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Blocked / Revoked</p>
              <h3 className="text-xl font-bold text-white font-mono">{revokedCount}</h3>
            </div>
          </div>
        </div>

        {/* TAB 1: LICENSES MANAGEMENT */}
        {activeTab === "licenses" && (
          <div className="space-y-6">
            
            {/* Top Toolbar: Generate Form and Search */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Form Card: Generate New Keys */}
              <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-5 shadow-lg lg:col-span-1">
                <div className="flex items-center gap-2 mb-4">
                  <PlusCircle className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white">Generate License Keys</h2>
                </div>

                <form onSubmit={handleGenerateKeys} className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1.5">
                      Subscription Plan Type
                    </label>
                    <select
                      value={newKeyType}
                      onChange={(e) => setNewKeyType(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="lifetime">Lifetime License (EPG-PRO-LIFETIME)</option>
                      <option value="7days">7-Day Trial (EPG-TRIAL-7DAYS)</option>
                      <option value="30days">30-Day Sub (EPG-DEMO-30DAYS)</option>
                      <option value="90days">90-Day Standard Plan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1.5">
                      Customer Name / Custom Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe Satellite Shop"
                      value={newKeyNotes}
                      onChange={(e) => setNewKeyNotes(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1.5">
                      Batch Keys Count (1 to 50)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={newKeyCount}
                        onChange={(e) => setNewKeyCount(parseInt(e.target.value) || 1)}
                        className="w-24 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                      <span className="text-xs text-zinc-500">keys in this batch</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={generating}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-bold text-xs rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    {generating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlusCircle className="w-3.5 h-3.5" />
                    )}
                    Generate Production Key(s)
                  </button>
                </form>
              </div>

              {/* Info Card / Quick Test Keys Guide */}
              <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-5 shadow-lg lg:col-span-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-sm font-semibold text-white">Interactive Verification Guide</h2>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    The Licensing System is fully connected. Enigma2 devices communicate directly with this dashboard to verify customer authenticity. 
                  </p>
                  
                  {/* Test Keys shortcuts */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl flex flex-col justify-between">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-emerald-400 font-mono">LIFETIME</span>
                        <span className="text-[9px] bg-zinc-900 text-zinc-500 px-1 rounded border border-zinc-800">FREE SEED</span>
                      </div>
                      <span className="text-xs font-bold font-mono text-white select-all">EPG-PRO-LIFETIME</span>
                      <p className="text-[9px] text-zinc-500 mt-2">Unlimited premium Arabic translation translation capabilities.</p>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl flex flex-col justify-between">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-blue-400 font-mono">30 DAYS</span>
                        <span className="text-[9px] bg-zinc-900 text-zinc-500 px-1 rounded border border-zinc-800">DEMO SEED</span>
                      </div>
                      <span className="text-xs font-bold font-mono text-white select-all">EPG-DEMO-30DAYS</span>
                      <p className="text-[9px] text-zinc-500 mt-2">30-day rental period, locks on first box registration.</p>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl flex flex-col justify-between">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-purple-400 font-mono">7 DAYS</span>
                        <span className="text-[9px] bg-zinc-900 text-zinc-500 px-1 rounded border border-zinc-800">TRIAL SEED</span>
                      </div>
                      <span className="text-xs font-bold font-mono text-white select-all">EPG-TRIAL-7DAYS</span>
                      <p className="text-[9px] text-zinc-500 mt-2">7-day validation window. Perfect for initial testing.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-850 flex flex-wrap gap-x-4 gap-y-2 items-center justify-between text-[11px] text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>Server Status: <strong className="text-emerald-400 font-medium">Online & Listening</strong></span>
                  </div>
                  <span>Hardware Binding: <strong className="text-zinc-300 font-medium">Stable Hashing Active</strong></span>
                </div>
              </div>
            </div>

            {/* List / Grid of All Registered Licenses */}
            <div className="bg-zinc-900 border border-zinc-850 rounded-2xl shadow-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white">Registered Licenses Inventory</h2>
                  <span className="text-xs bg-zinc-950 border border-zinc-800 text-zinc-400 px-2.5 py-0.5 rounded-full font-mono">
                    {filteredLicenses.length} shown
                  </span>
                </div>

                {/* Instant Search input */}
                <div className="relative w-full sm:w-72">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by key, HWID or notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Licenses Table container */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-850 text-zinc-500 font-medium bg-zinc-950/40">
                      <th className="px-5 py-3">License Activation Key</th>
                      <th className="px-5 py-3">Plan Type</th>
                      <th className="px-5 py-3">Bound HWID</th>
                      <th className="px-5 py-3">Registered Notes</th>
                      <th className="px-5 py-3">Expires At</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Administrative Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-zinc-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                          <span>Reading database entries...</span>
                        </td>
                      </tr>
                    ) : filteredLicenses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-zinc-500">
                          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
                          <span>No licensing records match your criteria.</span>
                        </td>
                      </tr>
                    ) : (
                      filteredLicenses.map((lic) => (
                        <tr key={lic.key} className="hover:bg-zinc-850/30 transition-all group">
                          {/* KEY */}
                          <td className="px-5 py-4 font-mono font-bold text-white selection:bg-cyan-500">
                            <div className="flex items-center gap-2">
                              <span>{lic.key}</span>
                              <button
                                onClick={() => triggerClipboardCopy(lic.key)}
                                className="opacity-0 group-hover:opacity-100 p-1 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded cursor-pointer transition-all border border-zinc-800"
                                title="Copy License Key"
                              >
                                {copiedKey === lic.key ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* TYPE */}
                          <td className="px-5 py-4 capitalize font-semibold text-zinc-300">
                            {lic.type === "lifetime" ? (
                              <span className="text-emerald-400 font-semibold">Lifetime</span>
                            ) : (
                              lic.type
                            )}
                          </td>

                          {/* BOUND HWID */}
                          <td className="px-5 py-4 font-mono font-medium text-zinc-400">
                            {lic.hwid ? (
                              <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-1 rounded border border-zinc-850 w-fit">
                                <Cpu className="w-3 h-3 text-cyan-500" />
                                <span>{lic.hwid}</span>
                              </div>
                            ) : (
                              <span className="text-zinc-600 italic">Not yet bound</span>
                            )}
                          </td>

                          {/* NOTES */}
                          <td className="px-5 py-4 text-zinc-300 italic max-w-[180px] truncate" title={lic.notes}>
                            {lic.notes || <span className="text-zinc-600">-</span>}
                          </td>

                          {/* EXPIRES */}
                          <td className="px-5 py-4 text-zinc-400">
                            {formatDate(lic.expires_at)}
                          </td>

                          {/* STATUS BADGE */}
                          <td className="px-5 py-4">
                            {getStatusBadge(lic.status)}
                          </td>

                          {/* ADMINISTRATIVE ACTIONS */}
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Reset HWID action */}
                              {lic.hwid && (
                                <button
                                  onClick={() => handleResetHWID(lic.key)}
                                  className="p-1.5 bg-zinc-950 hover:bg-blue-950/30 text-blue-400 hover:text-blue-300 rounded border border-zinc-850 hover:border-blue-500/30 cursor-pointer transition-all active:scale-95"
                                  title="Reset Hardware ID (Unbind Key)"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Toggle active / block status */}
                              {lic.status === "Revoked" ? (
                                <button
                                  onClick={() => handleEnableLicense(lic.key)}
                                  className="p-1.5 bg-zinc-950 hover:bg-emerald-950/30 text-emerald-400 hover:text-emerald-300 rounded border border-zinc-850 hover:border-emerald-500/30 cursor-pointer transition-all active:scale-95"
                                  title="Unblock License"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleRevokeLicense(lic.key)}
                                  className="p-1.5 bg-zinc-950 hover:bg-rose-950/30 text-rose-400 hover:text-rose-300 rounded border border-zinc-850 hover:border-rose-500/30 cursor-pointer transition-all active:scale-95"
                                  title="Block/Revoke License"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete Action */}
                              <button
                                onClick={() => handleDeleteLicense(lic.key)}
                                className="p-1.5 bg-zinc-950 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 rounded border border-zinc-850 hover:border-rose-500/20 cursor-pointer transition-all active:scale-95"
                                title="Delete License Permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVATION LOGS */}
        {activeTab === "logs" && (
          <div className="bg-zinc-900 border border-zinc-850 rounded-2xl shadow-lg overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-zinc-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Live Hardware Activation Logs</h2>
                <span className="text-xs bg-zinc-950 text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded-full font-mono">
                  {logs.length} events
                </span>
              </div>
              
              {logs.length > 0 && (
                <button
                  onClick={handleClearLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 hover:bg-rose-950/30 text-zinc-400 hover:text-rose-400 text-xs rounded-lg border border-zinc-800 hover:border-rose-500/20 cursor-pointer transition-all active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Events Logs
                </button>
              )}
            </div>

            {/* Terminal Log Output */}
            <div className="p-4 bg-zinc-950 overflow-hidden font-mono text-xs text-zinc-400 space-y-2 max-h-[550px] overflow-y-auto border-b border-zinc-850">
              <div className="text-zinc-600 mb-2 border-b border-zinc-900 pb-2 flex items-center justify-between">
                <span>[EPG-PRO LOGS LAYER v2.1.0 COMPACT VIEW]</span>
                <span>SYSTEM LOCAL TIME: 2026-07-13 00:56</span>
              </div>
              
              {logs.length === 0 ? (
                <div className="py-12 text-center text-zinc-600 italic">
                  &gt; Console is silent. No activation requests recorded.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-2 bg-zinc-900/40 rounded border border-zinc-900 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-zinc-900 transition-all">
                    <div className="flex items-start md:items-center gap-2.5 flex-wrap">
                      <span className="text-zinc-500 font-medium shrink-0">
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>
                      {getLogActionBadge(log.action)}
                      <span className="text-white font-bold tracking-tight">
                        {log.key}
                      </span>
                      <span className="text-zinc-500 shrink-0">→</span>
                      <span className="text-zinc-300 font-bold bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-850 flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-cyan-400" />
                        {log.hwid}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-right justify-between md:justify-end text-[11px]">
                      <span className="text-zinc-400 italic font-sans" title="Enigma2 Image name">
                        {log.image}
                      </span>
                      <span className="text-zinc-500 font-semibold bg-zinc-950/60 px-1.5 rounded border border-zinc-900 shrink-0">
                        IP: {log.ip.replace("::ffff:", "")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CLIENT DOWNLOAD CENTRE & SOURCE VIEWER */}
        {activeTab === "client" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Hand: Download Files Cards list */}
            <div className="space-y-4 lg:col-span-1">
              
              {/* Main Zip Installer Download card */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-cyan-500/20 hover:border-cyan-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition-all" />
                
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-cyan-950 border border-cyan-500/30 text-cyan-400 rounded-2xl shadow-md">
                    <Download className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                    PRODUCTION COMPLIED ZIP
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white mb-1.5">arabic_epg_protected.zip</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                  Contains the complete production build, including the Python obfuscated cores, security checks, and installation scripts. Ready to flash on any Enigma2 box.
                </p>

                <a
                  href="/api/download/zip"
                  download="arabic_epg_protected.zip"
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-cyan-500/10 active:scale-98 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Protected ZIP (Prod Build)
                </a>
              </div>

              {/* Source Files Cards */}
              <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-5 space-y-3 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileCode className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider">Client Source Files</h2>
                </div>

                <div className="space-y-2">
                  {[
                    { name: "plugin.py", desc: "Settings screen & key verification", icon: <FileCode className="w-3.5 h-3.5 text-blue-400" /> },
                    { name: "translator.py", desc: "Core translations & API routing", icon: <FileCode className="w-3.5 h-3.5 text-blue-400" /> },
                    { name: "__init__.py", desc: "Metadata & plugin definition", icon: <FileCode className="w-3.5 h-3.5 text-zinc-500" /> },
                    { name: "install.sh", desc: "SSH setup & auto compiled wrapper", icon: <FileText className="w-3.5 h-3.5 text-amber-500" /> },
                    { name: "uninstall.sh", desc: "SSH uninstallation cleaner", icon: <FileText className="w-3.5 h-3.5 text-rose-500" /> }
                  ].map((file) => (
                    <button
                      key={file.name}
                      onClick={() => setSelectedFile(file.name)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-all group ${
                        selectedFile === file.name 
                          ? "bg-zinc-950 border-cyan-500/30 ring-1 ring-cyan-500/20" 
                          : "bg-zinc-950/40 border-zinc-850 hover:bg-zinc-850/20"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 group-hover:text-white transition-all">
                          {file.icon}
                        </div>
                        <div>
                          <span className="text-xs font-bold font-mono text-white group-hover:text-cyan-400 transition-all">{file.name}</span>
                          <p className="text-[9px] text-zinc-500 mt-0.5">{file.desc}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-600 font-mono group-hover:text-zinc-400 transition-all">&gt;</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Hand: Code Source Viewer */}
            <div className="bg-zinc-900 border border-zinc-850 rounded-2xl shadow-lg lg:col-span-2 overflow-hidden flex flex-col h-[580px]">
              
              <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-850 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold font-mono text-white">{selectedFile}</span>
                  <span className="text-[9px] bg-zinc-900 text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded">
                    {selectedFile.endsWith('.py') ? "Python 3 File" : "Bash Script"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => triggerClipboardCopy(fileContent, true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[11px] font-medium rounded border border-zinc-800 cursor-pointer transition-all active:scale-95"
                    title="Copy Source Code"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? "Copied!" : "Copy Code"}
                  </button>
                  <a
                    href={`/api/download/raw/${selectedFile}`}
                    download={selectedFile}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-zinc-950 text-[11px] font-bold rounded cursor-pointer transition-all active:scale-95 shadow-md shadow-cyan-500/5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download File
                  </a>
                </div>
              </div>

              {/* Code viewer viewport */}
              <div className="flex-1 bg-zinc-950 p-4 font-mono text-[11px] overflow-y-auto leading-relaxed text-zinc-300">
                {loadingFile ? (
                  <div className="h-full flex items-center justify-center text-zinc-500">
                    <RefreshCw className="w-6 h-6 animate-spin mr-2 text-cyan-400" />
                    <span>Loading file content from server...</span>
                  </div>
                ) : (
                  <pre className="whitespace-pre select-text selection:bg-cyan-500 selection:text-black">
                    {fileContent}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer information */}
      <footer className="bg-zinc-900 border-t border-zinc-800 py-6 px-6 mt-12 text-center text-xs text-zinc-500">
        <p>© 2026 EPG-PRO Licensing and Protection Dashboard. All rights reserved.</p>
        <p className="mt-1 text-[10px] text-zinc-600">
          This system provides remote activation checking, hardware-bound anti-cloning cryptographic hashes, and live customer session management for Enigma2 receivers.
        </p>
      </footer>
    </div>
  );
}
