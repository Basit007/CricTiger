import React, { useState, useEffect } from 'react';
import { 
  Database, 
  X, 
  Check, 
  Copy, 
  RefreshCw, 
  ShieldCheck, 
  Lock, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  Table,
  Download,
  Upload,
  KeyRound,
  Users,
  Trash2,
  Server,
  FileSpreadsheet,
  HardDrive,
  Shield,
  Terminal
} from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { 
  getDeveloperDbConfig, 
  saveDeveloperDbConfig, 
  DeveloperDbConfig 
} from '../utils/storage';
import { 
  APPS_SCRIPT_TEMPLATE, 
  syncAllToGoogleSheets, 
  testGoogleSheetWebhook 
} from '../services/googleSheetsService';
import { MatchState } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  matchHistory: MatchState[];
  currentTeamName: string;
}

interface AdminOverviewData {
  success: boolean;
  database: {
    status: string;
    storageLocation: string;
    accountsFile: string;
    recordsFile: string;
    accountsSizeKb: string;
    recordsSizeKb: string;
    serverUptimeSeconds: number;
    serverTime: string;
    environment: string;
  };
  counts: {
    totalAccounts: number;
    totalMatches: number;
    totalTeams: number;
    totalPlayers: number;
  };
  accounts: Array<{
    id: string;
    teamName: string;
    username: string;
    city: string;
    managerName: string;
    createdAt?: number;
    matchesCount: number;
    teamsCount: number;
  }>;
}

export const DeveloperDbModal: React.FC<Props> = ({
  isOpen,
  onClose,
  matchHistory,
  currentTeamName
}) => {
  const [config, setConfig] = useState<DeveloperDbConfig>(getDeveloperDbConfig());
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'overview' | 'exports' | 'accounts' | 'webhook' | 'security'>('overview');
  
  // Overview data from /api/admin/overview
  const [overviewData, setOverviewData] = useState<AdminOverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Webhook settings
  const [webhookInput, setWebhookInput] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [newPin, setNewPin] = useState('');

  // Operations
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedApiUrl, setCopiedApiUrl] = useState(false);
  const [showScriptCode, setShowScriptCode] = useState(false);

  // Password reset inside admin
  const [resetModalAccount, setResetModalAccount] = useState<{ id: string; teamName: string; username: string } | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [actionMessage, setActionMessage] = useState<{ success: boolean; message: string } | null>(null);

  // Restore file
  const [restoreJsonFile, setRestoreJsonFile] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const freshConfig = getDeveloperDbConfig();
      setConfig(freshConfig);
      setWebhookInput(freshConfig.sheetWebhookUrl || '');
      setAutoSync(freshConfig.autoSyncOnMatchEnd);
      setTestResult(null);
      setSyncResult(null);
      setActionMessage(null);
    }
  }, [isOpen]);

  const fetchOverview = async () => {
    setLoadingOverview(true);
    try {
      const res = await fetch('/api/admin/overview');
      const data = await res.json();
      if (data.success) {
        setOverviewData(data);
      }
    } catch (err) {
      console.error('Failed to fetch admin overview', err);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    if (isUnlocked && isOpen) {
      fetchOverview();
    }
  }, [isUnlocked, isOpen]);

  if (!isOpen) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === config.adminPin || pinInput === '1234') {
      setIsUnlocked(true);
      setPinError('');
      fetchOverview();
    } else {
      setPinError('Incorrect Developer PIN. (Default: 1234)');
    }
  };

  const handleSaveConfig = () => {
    const updated: DeveloperDbConfig = {
      ...config,
      sheetWebhookUrl: webhookInput.trim(),
      autoSyncOnMatchEnd: autoSync,
      adminPin: newPin.trim() ? newPin.trim() : config.adminPin
    };
    saveDeveloperDbConfig(updated);
    setConfig(updated);
    setActionMessage({ success: true, message: 'Developer Database settings saved successfully!' });
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleTestWebhook = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testGoogleSheetWebhook(webhookInput);
    setTesting(false);
    setTestResult(res);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    const res = await syncAllToGoogleSheets(matchHistory, currentTeamName, webhookInput);
    setSyncing(false);
    setSyncResult(res);
    if (res.success) {
      setConfig(getDeveloperDbConfig());
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    });
  };

  const handleCopyApiUrl = (endpoint: string) => {
    const fullUrl = `${window.location.origin}${endpoint}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedApiUrl(true);
      setTimeout(() => setCopiedApiUrl(false), 2500);
    });
  };

  const handleResetPasswordSubmit = async () => {
    if (!resetModalAccount || !newPasswordInput.trim()) return;
    try {
      const res = await fetch('/api/admin/accounts/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: resetModalAccount.id,
          newPassword: newPasswordInput.trim(),
          adminPin: config.adminPin || '1234'
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ success: true, message: `Password for @${resetModalAccount.username} reset successfully!` });
        setResetModalAccount(null);
        setNewPasswordInput('');
        fetchOverview();
      } else {
        setActionMessage({ success: false, message: data.error || 'Failed to reset password' });
      }
    } catch (err: any) {
      setActionMessage({ success: false, message: err.message });
    }
  };

  const handleDeleteAccount = async (account: { id: string; teamName: string; username: string }) => {
    if (!confirm(`Are you sure you want to delete ${account.teamName} (@${account.username}) and all their match records?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/accounts/${account.id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-pin': config.adminPin || '1234'
        }
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ success: true, message: `Deleted ${account.teamName} successfully.` });
        fetchOverview();
      } else {
        setActionMessage({ success: false, message: data.error || 'Failed to delete account' });
      }
    } catch (err: any) {
      setActionMessage({ success: false, message: err.message });
    }
  };

  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setRestoreJsonFile(text);
      } catch (err) {
        alert('Failed to read file');
      }
    };
    reader.readAsText(file);
  };

  const handleApplyRestore = async () => {
    if (!restoreJsonFile) return;
    if (!confirm('Warning: Restoring will overwrite accounts and records with the backup file. Proceed?')) return;
    setIsRestoring(true);
    try {
      const parsed = JSON.parse(restoreJsonFile);
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backup: parsed,
          adminPin: config.adminPin || '1234'
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Database restored successfully!');
        setRestoreJsonFile('');
        fetchOverview();
      } else {
        alert(`Restore failed: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Invalid JSON format: ${e.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* MODAL HEADER */}
        <div className="p-4 bg-gray-950 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-tiger-gold/15 rounded-xl border border-tiger-gold/30 text-tiger-gold flex-shrink-0">
              <Database size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black uppercase text-white tracking-wide">
                  Developer & Cloud Operations
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Cloud
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Direct backend database access, Google Sheets exports & accounts control
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
          
          {/* PIN SCREEN */}
          {!isUnlocked ? (
            <form onSubmit={handleUnlock} className="py-8 flex flex-col items-center text-center space-y-4 max-w-xs mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center text-tiger-gold shadow-inner">
                <Lock size={30} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Developer & Owner Verification
                </h3>
                <p className="text-[11px] text-gray-400">
                  Full control over cloud storage, raw database JSON, Google Sheets exports, and team accounts.
                </p>
              </div>

              <div className="w-full space-y-2">
                <input
                  type="password"
                  placeholder="Enter PIN (Default: 1234)"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError('');
                  }}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-center text-sm font-mono tracking-widest text-white outline-none focus:border-tiger-gold"
                  autoFocus
                />
                {pinError && (
                  <p className="text-red-400 text-[11px] font-bold">{pinError}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-tiger-gold hover:bg-yellow-400 text-black font-black uppercase text-xs rounded-xl transition-all shadow-md active:scale-95"
              >
                Access Cloud Database
              </button>

              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-300 text-left">
                <strong>Default Developer PIN:</strong> <code>1234</code>. You can customize this PIN in Settings anytime.
              </div>
            </form>
          ) : (
            // UNLOCKED DEVELOPER DASHBOARD
            <ErrorBoundary fallbackTitle="Developer Dashboard Error">
            <div className="space-y-4">
              
              {/* Notification Banner */}
              {actionMessage && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  actionMessage.success 
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                    : 'bg-red-500/15 text-red-300 border-red-500/30'
                }`}>
                  {actionMessage.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{actionMessage.message}</span>
                </div>
              )}

              {/* NAVIGATION TABS */}
              <div className="flex flex-wrap gap-1.5 p-1 bg-gray-950 border border-gray-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                    activeTab === 'overview'
                      ? 'bg-tiger-gold text-black shadow'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Server size={14} />
                  <span>Cloud DB & APIs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('exports')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                    activeTab === 'exports'
                      ? 'bg-tiger-gold text-black shadow'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <FileSpreadsheet size={14} />
                  <span>Google Sheets / CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('accounts')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                    activeTab === 'accounts'
                      ? 'bg-tiger-gold text-black shadow'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Users size={14} />
                  <span>Team Accounts ({overviewData?.counts?.totalAccounts ?? '...'})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('webhook')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                    activeTab === 'webhook'
                      ? 'bg-tiger-gold text-black shadow'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Table size={14} />
                  <span>Live Webhook</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                    activeTab === 'security'
                      ? 'bg-tiger-gold text-black shadow'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Shield size={14} />
                  <span>PIN & Backup</span>
                </button>
              </div>

              {/* TAB 1: CLOUD DATABASE OVERVIEW & DIRECT APIS */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Database Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-gray-800/90 border border-gray-700 p-3 rounded-xl">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Team Accounts</div>
                      <div className="text-xl font-black text-white mt-0.5">
                        {overviewData?.counts?.totalAccounts ?? (loadingOverview ? '...' : 0)}
                      </div>
                      <div className="text-[9px] text-gray-500 mt-0.5">Stored in cloud</div>
                    </div>
                    <div className="bg-gray-800/90 border border-gray-700 p-3 rounded-xl">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Saved Matches</div>
                      <div className="text-xl font-black text-tiger-gold mt-0.5">
                        {overviewData?.counts?.totalMatches ?? (loadingOverview ? '...' : 0)}
                      </div>
                      <div className="text-[9px] text-gray-500 mt-0.5">Ball-by-ball logs</div>
                    </div>
                    <div className="bg-gray-800/90 border border-gray-700 p-3 rounded-xl">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Custom Squads</div>
                      <div className="text-xl font-black text-blue-400 mt-0.5">
                        {overviewData?.counts?.totalTeams ?? (loadingOverview ? '...' : 0)}
                      </div>
                      <div className="text-[9px] text-gray-500 mt-0.5">Configured rosters</div>
                    </div>
                    <div className="bg-gray-800/90 border border-gray-700 p-3 rounded-xl">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Total Players</div>
                      <div className="text-xl font-black text-emerald-400 mt-0.5">
                        {overviewData?.counts?.totalPlayers ?? (loadingOverview ? '...' : 0)}
                      </div>
                      <div className="text-[9px] text-gray-500 mt-0.5">Tracked career stats</div>
                    </div>
                  </div>

                  {/* Server & Database Location Banner */}
                  <div className="bg-gray-800/80 border border-gray-700 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HardDrive size={16} className="text-tiger-gold" />
                        <h4 className="font-bold text-white text-xs uppercase">Cloud Database Storage Details</h4>
                      </div>
                      <button
                        onClick={fetchOverview}
                        className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1"
                      >
                        <RefreshCw size={12} className={loadingOverview ? 'animate-spin' : ''} />
                        Refresh
                      </button>
                    </div>

                    <div className="bg-black/60 border border-gray-800 rounded-lg p-3 font-mono text-[11px] space-y-1.5 text-gray-300">
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-gray-400">Data Directory:</span>
                        <span className="text-tiger-gold select-all">{overviewData?.database?.storageLocation || '/data'}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-gray-400">Accounts DB File:</span>
                        <span className="text-white select-all">accounts.json ({overviewData?.database?.accountsSizeKb || '0'} KB)</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-gray-400">Match Records DB File:</span>
                        <span className="text-white select-all">team_records.json ({overviewData?.database?.recordsSizeKb || '0'} KB)</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-gray-400">Server Uptime:</span>
                        <span className="text-emerald-400">
                          {overviewData?.database?.serverUptimeSeconds 
                            ? `${Math.floor((overviewData.database?.serverUptimeSeconds || 0) / 60)} minutes (${overviewData.database?.serverUptimeSeconds}s)`
                            : 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Direct Browser & API Endpoints for Developer */}
                  <div className="bg-gray-800/80 border border-gray-700 p-4 rounded-xl space-y-3">
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-white text-xs uppercase flex items-center gap-1.5">
                        <Terminal size={14} className="text-tiger-gold" />
                        How to Access Your Cloud Database Directly
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        As the app owner, you can query and inspect the live database directly in any browser tab or script using these built-in endpoints:
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2.5 bg-black/50 border border-gray-800 rounded-lg flex items-center justify-between gap-2">
                        <div>
                          <div className="text-white font-bold font-mono text-[11px]">GET /api/admin/overview</div>
                          <div className="text-[10px] text-gray-400">Database health, metrics, storage file size & team counts</div>
                        </div>
                        <a
                          href="/api/admin/overview"
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-gray-700 hover:bg-gray-650 text-tiger-gold rounded-lg text-[11px] font-bold flex items-center gap-1"
                        >
                          <ExternalLink size={12} /> Open
                        </a>
                      </div>

                      <div className="p-2.5 bg-black/50 border border-gray-800 rounded-lg flex items-center justify-between gap-2">
                        <div>
                          <div className="text-white font-bold font-mono text-[11px]">GET /api/accounts</div>
                          <div className="text-[10px] text-gray-400">List of all registered club accounts across devices</div>
                        </div>
                        <a
                          href="/api/accounts"
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-gray-700 hover:bg-gray-650 text-tiger-gold rounded-lg text-[11px] font-bold flex items-center gap-1"
                        >
                          <ExternalLink size={12} /> Open
                        </a>
                      </div>

                      <div className="p-2.5 bg-black/50 border border-gray-800 rounded-lg flex items-center justify-between gap-2">
                        <div>
                          <div className="text-white font-bold font-mono text-[11px]">GET /api/admin/backup?download=1</div>
                          <div className="text-[10px] text-gray-400">Raw JSON snapshot of the entire database (all teams + all matches)</div>
                        </div>
                        <a
                          href="/api/admin/backup?download=1"
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-gray-700 hover:bg-gray-650 text-tiger-gold rounded-lg text-[11px] font-bold flex items-center gap-1"
                        >
                          <Download size={12} /> Download
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EXPORT TO GOOGLE SHEETS / CSV */}
              {activeTab === 'exports' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5">
                    <FileSpreadsheet size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1 text-gray-300 text-[11px]">
                      <p className="font-bold text-white text-xs">1-Click Google Sheets / Excel Spreadsheet Downloads</p>
                      <p>
                        These clean CSV files format instantly in Google Sheets or Microsoft Excel. You can import them directly into a spreadsheet at <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-tiger-gold underline font-bold">sheets.new</a>.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Accounts CSV */}
                    <div className="p-4 bg-gray-800/90 border border-gray-700 rounded-xl flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="font-black text-white text-xs uppercase flex items-center gap-1.5">
                          <Users size={14} className="text-tiger-gold" />
                          Club Accounts (.csv)
                        </div>
                        <p className="text-[11px] text-gray-400">
                          Export team names, registered usernames, managers, cities, and squad counts.
                        </p>
                      </div>
                      <a
                        href="/api/admin/export/csv?type=accounts"
                        download
                        className="w-full py-2 bg-gray-700 hover:bg-gray-650 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors border border-gray-600"
                      >
                        <Download size={14} className="text-tiger-gold" />
                        Download Accounts CSV
                      </a>
                    </div>

                    {/* All Matches CSV */}
                    <div className="p-4 bg-gray-800/90 border border-gray-700 rounded-xl flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="font-black text-white text-xs uppercase flex items-center gap-1.5">
                          <Table size={14} className="text-tiger-gold" />
                          All Match Scorecards (.csv)
                        </div>
                        <p className="text-[11px] text-gray-400">
                          Complete match archives: overs, toss, scores, wickets, winners, and margins.
                        </p>
                      </div>
                      <a
                        href="/api/admin/export/csv?type=matches"
                        download
                        className="w-full py-2 bg-gray-700 hover:bg-gray-650 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors border border-gray-600"
                      >
                        <Download size={14} className="text-tiger-gold" />
                        Download Matches CSV
                      </a>
                    </div>

                    {/* Squad Rosters CSV */}
                    <div className="p-4 bg-gray-800/90 border border-gray-700 rounded-xl flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="font-black text-white text-xs uppercase flex items-center gap-1.5">
                          <Shield size={14} className="text-tiger-gold" />
                          Team Squads & Rosters (.csv)
                        </div>
                        <p className="text-[11px] text-gray-400">
                          Complete directory of every configured club, sub-team, and player names.
                        </p>
                      </div>
                      <a
                        href="/api/admin/export/csv?type=squads"
                        download
                        className="w-full py-2 bg-gray-700 hover:bg-gray-650 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors border border-gray-600"
                      >
                        <Download size={14} className="text-tiger-gold" />
                        Download Squads CSV
                      </a>
                    </div>

                    {/* Full JSON Backup */}
                    <div className="p-4 bg-gray-800/90 border border-gray-700 rounded-xl flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="font-black text-white text-xs uppercase flex items-center gap-1.5">
                          <Database size={14} className="text-emerald-400" />
                          Full Database Snapshot (.json)
                        </div>
                        <p className="text-[11px] text-gray-400">
                          Complete machine-readable backup containing all accounts, matches, and configurations.
                        </p>
                      </div>
                      <a
                        href="/api/admin/backup?download=1"
                        download
                        className="w-full py-2 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors border border-emerald-500/40"
                      >
                        <Download size={14} />
                        Download Full Cloud Backup
                      </a>
                    </div>
                  </div>

                  {/* Quick Guide to open in Google Sheets */}
                  <div className="p-3.5 bg-black/60 border border-gray-800 rounded-xl space-y-2 text-[11px] text-gray-300">
                    <div className="font-bold text-tiger-gold">How to view in Google Sheets in 10 seconds:</div>
                    <ol className="list-decimal list-inside space-y-1 text-gray-400">
                      <li>Click any download button above to save the <code>.csv</code> file.</li>
                      <li>Open <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-tiger-gold underline font-bold">sheets.new</a> in your browser.</li>
                      <li>Click <strong>File &gt; Import &gt; Upload</strong> and drop your CSV file.</li>
                      <li>Select <strong>Replace spreadsheet</strong> and click <strong>Import data</strong>.</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* TAB 3: TEAM ACCOUNTS & PASSWORD MANAGER */}
              {activeTab === 'accounts' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-xs uppercase">Registered Team Accounts</h4>
                      <p className="text-[11px] text-gray-400">
                        View all teams registered in your cloud database, manage passwords, or remove test clubs.
                      </p>
                    </div>
                    <button
                      onClick={fetchOverview}
                      className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs flex items-center gap-1 border border-gray-700"
                    >
                      <RefreshCw size={12} className={loadingOverview ? 'animate-spin' : ''} />
                      Refresh
                    </button>
                  </div>

                  {/* Password Reset Submodal */}
                  {resetModalAccount && (
                    <div className="p-4 bg-gray-950 border border-tiger-gold/40 rounded-xl space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-tiger-gold text-xs">
                          Reset Password for {resetModalAccount.teamName} (@{resetModalAccount.username})
                        </span>
                        <button
                          onClick={() => setResetModalAccount(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          placeholder="Enter new password (min 4 chars)"
                          value={newPasswordInput}
                          onChange={(e) => setNewPasswordInput(e.target.value)}
                          className="flex-1 bg-gray-900 border border-gray-700 px-3 py-2 rounded-xl text-white text-xs outline-none focus:border-tiger-gold"
                        />
                        <button
                          onClick={handleResetPasswordSubmit}
                          className="px-3.5 py-2 bg-tiger-gold text-black font-bold rounded-xl text-xs"
                        >
                          Update Password
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Accounts List */}
                  <div className="space-y-2">
                    {overviewData?.accounts && overviewData.accounts.length > 0 ? (
                      overviewData.accounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="p-3 bg-gray-800/90 border border-gray-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="space-y-0.5 overflow-hidden">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-white text-xs">{acc.teamName}</span>
                              <span className="text-[10px] text-tiger-gold font-mono">@{acc.username}</span>
                            </div>
                            <p className="text-[10px] text-gray-400">
                              Manager: {acc.managerName || '—'} • City: {acc.city || '—'} • Matches: <strong className="text-white">{acc.matchesCount}</strong> • Squads: <strong className="text-white">{acc.teamsCount}</strong>
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => {
                                setResetModalAccount(acc);
                                setNewPasswordInput('');
                              }}
                              className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-650 text-gray-200 hover:text-tiger-gold font-bold text-[11px] rounded-lg flex items-center gap-1 border border-gray-600 transition-colors"
                              title="Reset Password"
                            >
                              <KeyRound size={12} />
                              <span>Reset Password</span>
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(acc)}
                              className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-[11px] rounded-lg border border-red-500/30 transition-colors"
                              title="Delete Account"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-gray-500 bg-gray-800/40 rounded-xl border border-gray-800">
                        {loadingOverview ? 'Loading cloud accounts...' : 'No accounts found in cloud database.'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: GOOGLE SHEETS LIVE WEBHOOK */}
              {activeTab === 'webhook' && (
                <div className="space-y-4">
                  {/* Google Sheet Webhook Connection */}
                  <div className="space-y-2 bg-gray-800/80 p-4 rounded-xl border border-gray-700">
                    <label className="block text-xs font-black uppercase tracking-wide text-white">
                      Google Sheet Webhook URL (Optional Live Auto-Sync)
                    </label>
                    <p className="text-[11px] text-gray-400">
                      If you deploy our free Google Apps Script on your Google Sheet, the app will auto-append every match to your sheet in real time.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://script.google.com/macros/s/.../exec"
                        value={webhookInput}
                        onChange={(e) => setWebhookInput(e.target.value)}
                        className="flex-1 bg-black/60 border border-gray-700 px-3 py-2 rounded-xl text-white font-mono text-xs outline-none focus:border-tiger-gold"
                      />
                      <button
                        onClick={handleTestWebhook}
                        disabled={testing || !webhookInput}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-650 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        {testing ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
                        <span>Test</span>
                      </button>
                    </div>

                    {testResult && (
                      <div className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 ${
                        testResult.success ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/15 text-red-300 border border-red-500/30'
                      }`}>
                        {testResult.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                        <span>{testResult.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Sync Actions */}
                  <div className="space-y-3 bg-gray-800/80 p-4 rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-black uppercase text-white">Push Match Logs to Live Sheet</h3>
                        <p className="text-[11px] text-gray-400">
                          Manually push all {matchHistory.length} matches and player stats to your linked sheet.
                        </p>
                      </div>
                      <button
                        onClick={handleSyncNow}
                        disabled={syncing || !webhookInput}
                        className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase rounded-xl text-xs flex items-center gap-1.5 shadow transition-all active:scale-95 disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                        <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
                      </button>
                    </div>

                    {/* Auto Sync Toggle */}
                    <div className="pt-2 border-t border-gray-700 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-bold text-white text-xs">Auto-Sync on Match Finish</span>
                        <p className="text-[10px] text-gray-400">
                          Automatically post completed matches and averages to your Google Sheet without manual action.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAutoSync(!autoSync)}
                        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                          autoSync ? 'bg-tiger-gold' : 'bg-gray-700'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-black shadow transform transition-transform ${
                          autoSync ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {syncResult && (
                      <div className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 ${
                        syncResult.success ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/15 text-red-300 border border-red-500/30'
                      }`}>
                        {syncResult.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                        <span>{syncResult.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Google Apps Script Code */}
                  <div className="bg-gray-800/80 p-4 rounded-xl border border-gray-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Table size={16} className="text-tiger-gold" />
                        <span className="font-black uppercase text-xs text-white">Free Apps Script Template</span>
                      </div>
                      <button
                        onClick={handleCopyScript}
                        className="px-2.5 py-1 bg-gray-700 hover:bg-gray-650 text-tiger-gold font-bold rounded-lg text-xs flex items-center gap-1 transition-colors"
                      >
                        {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiedCode ? 'Copied Script!' : 'Copy Apps Script'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowScriptCode(!showScriptCode)}
                      className="text-[11px] text-gray-400 hover:text-white underline block"
                    >
                      {showScriptCode ? 'Hide script preview' : 'View script source code preview'}
                    </button>

                    {showScriptCode && (
                      <pre className="p-3 bg-black/80 rounded-lg border border-gray-800 text-[10px] font-mono text-gray-300 overflow-x-auto max-h-48">
                        {APPS_SCRIPT_TEMPLATE}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: SECURITY & DATABASE RESTORE */}
              {activeTab === 'security' && (
                <div className="space-y-4">
                  {/* Change Developer PIN */}
                  <div className="bg-gray-800/80 p-4 rounded-xl border border-gray-700 space-y-2">
                    <span className="font-black uppercase text-xs text-white block">Developer Access PIN</span>
                    <p className="text-[11px] text-gray-400">
                      Set a custom PIN to protect this console. (Current PIN: <code>{config.adminPin || '1234'}</code>)
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter new PIN"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        className="w-48 bg-black/60 border border-gray-700 px-3 py-2 rounded-xl text-white font-mono text-xs outline-none focus:border-tiger-gold"
                      />
                      <button
                        onClick={handleSaveConfig}
                        className="px-4 py-2 bg-tiger-gold text-black font-bold text-xs rounded-xl"
                      >
                        Update PIN
                      </button>
                    </div>
                  </div>

                  {/* Restore Database from JSON */}
                  <div className="bg-gray-800/80 p-4 rounded-xl border border-gray-700 space-y-3">
                    <div className="space-y-1">
                      <span className="font-black uppercase text-xs text-white block flex items-center gap-1.5">
                        <Upload size={14} className="text-tiger-gold" />
                        Restore Cloud Database from Backup File
                      </span>
                      <p className="text-[11px] text-gray-400">
                        Upload a previously downloaded <code>.json</code> database backup to restore accounts, teams, and matches.
                      </p>
                    </div>

                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestoreFileSelected}
                      className="block w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-gray-700 file:text-white hover:file:bg-gray-650 cursor-pointer"
                    />

                    {restoreJsonFile && (
                      <div className="p-3 bg-black/50 rounded-xl border border-gray-800 flex items-center justify-between">
                        <span className="text-[11px] text-emerald-400 font-mono">Backup file loaded and ready!</span>
                        <button
                          onClick={handleApplyRestore}
                          disabled={isRestoring}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg transition-colors"
                        >
                          {isRestoring ? 'Restoring...' : 'Confirm Restore Database'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
            </ErrorBoundary>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-3 bg-gray-950 border-t border-gray-800 flex justify-between items-center">
          <div className="text-[10px] text-gray-500">
            {isUnlocked ? 'Developer Mode • Cloud Database Online' : 'Developer Verification Required'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs"
            >
              Close
            </button>
            {isUnlocked && activeTab === 'webhook' && (
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 rounded-xl bg-tiger-gold hover:bg-yellow-400 text-black font-black text-xs uppercase shadow"
              >
                Save Settings
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
