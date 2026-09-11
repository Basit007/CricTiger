import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  User, 
  PlusCircle, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Trophy, 
  Sparkles, 
  MapPin, 
  CheckCircle2,
  KeyRound,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Cloud,
  Database,
  FileSpreadsheet,
  LogIn
} from 'lucide-react';
import { TeamAccount } from '../types';
import { 
  loginTeamAccount, 
  registerTeamAccount, 
  getTeamAccounts,
  resetTeamPasswordWithPin,
  initServerSync
} from '../utils/storage';
import { AppLogo } from './AppLogo';

interface Props {
  onLoginSuccess: (account: TeamAccount) => void;
  onOpenDevDb?: () => void;
}

const PRESET_LOGOS = [
  { name: 'Tiger', emoji: '🐯', color: 'from-amber-500 to-yellow-600' },
  { name: 'Falcon', emoji: '🦅', color: 'from-blue-600 to-cyan-500' },
  { name: 'Lion', emoji: '🦁', color: 'from-red-600 to-orange-500' },
  { name: 'Rhino', emoji: '🦏', color: 'from-emerald-600 to-teal-500' },
  { name: 'Panther', emoji: '🐆', color: 'from-purple-600 to-pink-500' },
];

export const AuthScreen: React.FC<Props> = ({ onLoginSuccess, onOpenDevDb }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredAccounts, setRegisteredAccounts] = useState<TeamAccount[]>(getTeamAccounts());
  
  // Login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Forgot password form
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotAdminPin, setForgotAdminPin] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // Register form
  const [regTeamName, setRegTeamName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regManager, setRegManager] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customSquad, setCustomSquad] = useState('');
  const [showSquadInput, setShowSquadInput] = useState(false);
  const [regError, setRegError] = useState('');

  // Sync with server on screen mount to download any accounts created on other devices
  useEffect(() => {
    let isMounted = true;
    const loadAndSync = async () => {
      await initServerSync();
      if (isMounted) {
        setRegisteredAccounts(getTeamAccounts());
      }
    };
    loadAndSync();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError('');
    if (!loginUsername.trim()) {
      setLoginError('Please enter your team username.');
      return;
    }
    if (!loginPassword) {
      setLoginError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginTeamAccount(loginUsername, loginPassword);
      if (!res.success || !res.account) {
        setLoginError(res.error || 'Login failed.');
        setIsSubmitting(false);
        return;
      }
      onLoginSuccess(res.account);
    } catch (err: any) {
      setLoginError(err.message || 'Login error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    const trimmedUser = forgotUsername.trim().toLowerCase();
    if (!trimmedUser) {
      setForgotError('Please enter your team username.');
      return;
    }
    if (!forgotAdminPin.trim()) {
      setForgotError('Please enter the Developer / Admin PIN (Default: 1234).');
      return;
    }
    if (forgotNewPassword.length < 4) {
      setForgotError('New password must be at least 4 characters long.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('New passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetTeamPasswordWithPin(trimmedUser, forgotAdminPin.trim(), forgotNewPassword);
      if (!res.success) {
        setForgotError(res.error || 'Password reset failed.');
        setIsSubmitting(false);
        return;
      }

      setForgotSuccess(`Password for "${trimmedUser}" was reset successfully!`);
      setLoginUsername(trimmedUser);
      setLoginPassword(forgotNewPassword);
    } catch (err: any) {
      setForgotError(err.message || 'Password reset error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    let initialSquad: string[] | undefined = undefined;
    if (customSquad.trim()) {
      const parsed = customSquad
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);
      if (parsed.length < 11) {
        setRegError('Please provide at least 11 players for your squad, or leave blank to auto-generate.');
        return;
      }
      initialSquad = parsed;
    }

    setIsSubmitting(true);
    try {
      const res = await registerTeamAccount({
        teamName: regTeamName,
        username: regUsername,
        password: regPassword,
        city: regCity,
        managerName: regManager,
        logoUrl: PRESET_LOGOS[selectedPreset]?.emoji,
        initialSquad,
      });

      if (!res.success || !res.account) {
        setRegError(res.error || 'Registration failed.');
        setIsSubmitting(false);
        return;
      }

      onLoginSuccess(res.account);
    } catch (err: any) {
      setRegError(err.message || 'Registration error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Demo Helper to seed 2 distinct teams for immediate multi-tenant testing
  const handleSeedDemoTeams = async () => {
    setIsSubmitting(true);
    const resA = await registerTeamAccount({
      teamName: 'Taxila Tigers',
      username: 'tigers_xi',
      password: 'password',
      city: 'Taxila',
      managerName: 'Coach Imran',
      logoUrl: '🐯',
    });

    await registerTeamAccount({
      teamName: 'Rawalpindi Royals',
      username: 'royals_xi',
      password: 'password',
      city: 'Rawalpindi',
      managerName: 'Captain Babar',
      logoUrl: '🦁',
    });

    setRegisteredAccounts(getTeamAccounts());
    setIsSubmitting(false);

    if (resA.success && resA.account) {
      setLoginUsername('tigers_xi');
      setLoginPassword('password');
      setMode('login');
      setLoginError('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-tiger-black text-white overflow-y-auto no-scrollbar">
      <div className="p-4 sm:p-6 max-w-md mx-auto w-full flex flex-col min-h-full justify-center">
        
        {/* Branding Header */}
        <div className="flex flex-col items-center mb-6 pt-4 text-center">
          <div className="mb-3 drop-shadow-[0_0_20px_rgba(251,191,36,0.35)]">
            <AppLogo size={90} />
          </div>
          <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
            Cric<span className="text-tiger-gold">Tiger</span>
          </h1>
          <p className="text-gray-400 text-xs tracking-widest uppercase font-semibold mt-0.5">
            Team Club Portal & Scoring Engine
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tiger-gold/10 border border-tiger-gold/20 text-tiger-gold text-[11px] font-medium">
            <Cloud size={13} className="text-tiger-gold animate-pulse" />
            <span>Cross-Device Cloud Sync Active</span>
          </div>
        </div>

        {/* Developer / Owner Cloud Database Header Card */}
        {onOpenDevDb && (
          <div className="mb-4 p-3 bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900 border border-tiger-gold/40 rounded-2xl shadow-xl flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-tiger-gold/15 text-tiger-gold border border-tiger-gold/30 flex-shrink-0">
                <Database size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black uppercase text-white tracking-wide">Developer & Cloud DB</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase">
                    PIN: 1234
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 truncate">Google Sheets exports, Cloud JSON & Accounts</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenDevDb}
              className="px-3 py-1.5 bg-tiger-gold hover:bg-yellow-400 text-black font-black uppercase text-[11px] rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1 whitespace-nowrap flex-shrink-0"
            >
              <span>Open Console</span>
              <ArrowRight size={12} />
            </button>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="bg-gray-900/80 p-1 rounded-xl border border-gray-800 flex gap-1 mb-5">
          <button
            type="button"
            onClick={() => { setMode('login'); setLoginError(''); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              mode === 'login'
                ? 'bg-tiger-gold text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Team Login
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setRegError(''); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              mode === 'register'
                ? 'bg-tiger-gold text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Register Team
          </button>
        </div>

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4 bg-gray-900/60 p-5 rounded-2xl border border-gray-800 shadow-xl">
            {loginError && (
              <div className="p-3 bg-red-900/30 border border-red-700/60 rounded-xl text-red-300 text-xs font-medium">
                {loginError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Team Username / ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="e.g. tigers_xi or coach_ali"
                  className="w-full bg-gray-800 border border-gray-700 text-white pl-9 pr-3 py-2.5 rounded-xl outline-none focus:border-tiger-gold text-sm transition-all"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotUsername(loginUsername);
                    setMode('forgot');
                    setForgotError('');
                    setForgotSuccess('');
                  }}
                  className="text-[11px] text-tiger-gold hover:underline font-semibold"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Lock size={16} />
                </div>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your team password"
                  className="w-full bg-gray-800 border border-gray-700 text-white pl-9 pr-10 py-2.5 rounded-xl outline-none focus:border-tiger-gold text-sm transition-all"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300"
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 bg-gradient-to-r from-tiger-gold to-tiger-orange hover:from-yellow-400 hover:to-orange-500 disabled:opacity-50 text-black font-black uppercase tracking-widest py-3 rounded-xl shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2 text-sm"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Logging In Across Devices...</span>
                </>
              ) : (
                <>
                  <span>Login to Club</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Quick Switcher for registered teams on this device */}
            {registeredAccounts.length > 0 && (
              <div className="pt-3 border-t border-gray-800">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">
                  Quick Select Team on this device:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {registeredAccounts.map(acc => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setLoginUsername(acc.username);
                        setLoginError('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700 hover:border-tiger-gold text-xs text-gray-300 flex items-center gap-1.5 transition-all"
                    >
                      <span>{acc.logoUrl || '🏏'}</span>
                      <span className="font-semibold text-white">{acc.teamName}</span>
                      <span className="text-[10px] text-gray-500">(@{acc.username})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* If no teams exist yet, offer a 1-click demo setup */}
            {registeredAccounts.length === 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSeedDemoTeams}
                  className="w-full py-2 px-3 rounded-xl bg-gray-800/60 border border-gray-700 hover:border-tiger-gold/50 text-[11px] text-gray-300 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Sparkles size={13} className="text-tiger-gold" />
                  <span>Create 2 Sample Teams to test multi-team feature</span>
                </button>
              </div>
            )}
          </form>
        )}

        {/* FORGOT / RESET PASSWORD FORM */}
        {mode === 'forgot' && (
          <form onSubmit={handleResetPassword} className="space-y-4 bg-gray-900/60 p-5 rounded-2xl border border-gray-800 shadow-xl">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-800">
              <button
                type="button"
                onClick={() => { setMode('login'); setForgotError(''); }}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                title="Back to login"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h3 className="text-sm font-black uppercase text-white tracking-wide flex items-center gap-1.5">
                  <KeyRound size={15} className="text-tiger-gold" />
                  <span>Reset Team Password</span>
                </h3>
                <p className="text-[10px] text-gray-400">
                  Verify using the Developer / Admin Master PIN
                </p>
              </div>
            </div>

            {forgotError && (
              <div className="p-3 bg-red-900/30 border border-red-700/60 rounded-xl text-red-300 text-xs font-medium flex items-start gap-2">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess ? (
              <div className="space-y-4 py-2 text-center">
                <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex flex-col items-center gap-2">
                  <CheckCircle2 size={24} className="text-emerald-400" />
                  <span className="font-bold">{forgotSuccess}</span>
                  <p className="text-[11px] text-gray-400">
                    Your new password has been updated securely.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setForgotSuccess('');
                  }}
                  className="w-full bg-gradient-to-r from-tiger-gold to-tiger-orange hover:from-yellow-400 hover:to-orange-500 text-black font-black uppercase tracking-widest py-3 rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 text-xs"
                >
                  <span>Proceed to Login</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Team Username / ID *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      placeholder="e.g. lahoretigers or coach_ali"
                      className="w-full bg-gray-800 border border-gray-700 text-white pl-9 pr-3 py-2.5 rounded-xl outline-none focus:border-tiger-gold text-sm transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Developer / Admin PIN *
                    </label>
                    <span className="text-[10px] text-gray-500 font-mono">Default: 1234</span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                      <Shield size={16} />
                    </div>
                    <input
                      type="password"
                      value={forgotAdminPin}
                      onChange={(e) => setForgotAdminPin(e.target.value)}
                      placeholder="Enter Admin PIN"
                      className="w-full bg-gray-800 border border-gray-700 text-white pl-9 pr-3 py-2.5 rounded-xl outline-none focus:border-tiger-gold text-sm transition-all font-mono"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Contact your team admin or club developer for this PIN.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    New Password *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Enter at least 4 characters"
                      className="w-full bg-gray-800 border border-gray-700 text-white pl-9 pr-10 py-2.5 rounded-xl outline-none focus:border-tiger-gold text-sm transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300"
                    >
                      {showForgotNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full bg-gray-800 border border-gray-700 text-white pl-9 pr-3 py-2.5 rounded-xl outline-none focus:border-tiger-gold text-sm transition-all"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 bg-gradient-to-r from-tiger-gold to-tiger-orange hover:from-yellow-400 hover:to-orange-500 disabled:opacity-50 text-black font-black uppercase tracking-widest py-3 rounded-xl shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Resetting Across Devices...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound size={16} />
                      <span>Set New Password</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setForgotError(''); }}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Remember your password? <span className="text-tiger-gold font-bold">Back to Login</span>
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4 bg-gray-900/60 p-5 rounded-2xl border border-gray-800 shadow-xl">
            {regError && (
              <div className="p-3 bg-red-900/30 border border-red-700/60 rounded-xl text-red-300 text-xs font-medium">
                {regError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Official Team Name *
              </label>
              <input
                type="text"
                value={regTeamName}
                onChange={(e) => setRegTeamName(e.target.value)}
                placeholder="e.g. Lahore Qalandars or Islamabad XI"
                className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2.5 rounded-xl outline-none focus:border-tiger-gold text-sm transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Username / ID *
                </label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="e.g. lahore_xi"
                  className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2.5 rounded-xl outline-none focus:border-tiger-gold text-sm transition-all font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Password *
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Min 4 characters"
                  className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2.5 rounded-xl outline-none focus:border-tiger-gold text-sm transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  City / Home Ground
                </label>
                <input
                  type="text"
                  value={regCity}
                  onChange={(e) => setRegCity(e.target.value)}
                  placeholder="e.g. Lahore"
                  className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-xl outline-none focus:border-tiger-gold text-xs transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Captain / Manager
                </label>
                <input
                  type="text"
                  value={regManager}
                  onChange={(e) => setRegManager(e.target.value)}
                  placeholder="e.g. Shaheen Afridi"
                  className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-xl outline-none focus:border-tiger-gold text-xs transition-all"
                />
              </div>
            </div>

            {/* Team Crest / Mascot Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Select Team Emblem
              </label>
              <div className="flex gap-2 justify-between">
                {PRESET_LOGOS.map((item, idx) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setSelectedPreset(idx)}
                    className={`flex-1 py-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      selectedPreset === idx
                        ? 'border-tiger-gold bg-tiger-gold/15 text-tiger-gold shadow-md'
                        : 'border-gray-800 bg-gray-800/60 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <span className="text-xl">{item.emoji}</span>
                    <span className="text-[9px] font-bold uppercase">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Custom Squad setup */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowSquadInput(!showSquadInput)}
                className="text-[11px] text-tiger-gold hover:underline flex items-center gap-1 font-semibold"
              >
                <span>{showSquadInput ? '▲ Hide Custom Squad' : '▼ Customize Playing Squad (Optional)'}</span>
              </button>
              {showSquadInput && (
                <div className="mt-2 space-y-1">
                  <label className="text-[10px] text-gray-400">Enter player names (one per line, min 11):</label>
                  <textarea
                    rows={5}
                    value={customSquad}
                    onChange={(e) => setCustomSquad(e.target.value)}
                    placeholder={`Babar Azam\nShaheen Afridi\nHaris Rauf\n...`}
                    className="w-full bg-gray-800 border border-gray-700 text-white p-2 rounded-xl text-xs outline-none focus:border-tiger-gold font-sans"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 bg-gradient-to-r from-tiger-gold to-tiger-orange hover:from-yellow-400 hover:to-orange-500 disabled:opacity-50 text-black font-black uppercase tracking-widest py-3 rounded-xl shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2 text-sm"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Registering Across Devices...</span>
                </>
              ) : (
                <>
                  <PlusCircle size={16} />
                  <span>Create Team Account</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* OWNER & DEVELOPER QUICK EXPORT FOOTER CARD */}
        <div className="mt-5 p-4 bg-gray-900/90 border border-gray-800 rounded-2xl text-center space-y-3 shadow-xl">
          <div className="flex items-center justify-center gap-2 text-tiger-gold text-xs font-black uppercase tracking-wider">
            <Database size={16} />
            <span>Owner & Developer Cloud Database</span>
          </div>
          <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
            Full backend control: export scores to Google Sheets, view raw database JSON, or manage club accounts.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {onOpenDevDb && (
              <button
                type="button"
                onClick={onOpenDevDb}
                className="px-3 py-2 bg-tiger-gold hover:bg-yellow-400 text-black rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow transition-all active:scale-95"
              >
                <Database size={14} />
                <span>Open Developer Console (PIN: 1234)</span>
              </button>
            )}
            <a
              href="/api/admin/export/csv?type=matches"
              download
              className="px-3 py-2 bg-gray-800 hover:bg-gray-750 border border-gray-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet size={14} className="text-emerald-400" />
              <span>Export Matches to Google Sheets (.csv)</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
