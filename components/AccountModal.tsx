import React, { useState } from 'react';
import { Shield, KeyRound, Lock, X, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import { TeamAccount } from '../types';
import { resetTeamPasswordWithPin } from '../utils/storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: TeamAccount;
  onLogout: () => void;
}

export const AccountModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentAccount,
  onLogout
}) => {
  const [adminPin, setAdminPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!adminPin.trim()) {
      setError('Please enter the Developer / Admin PIN (Default: 1234).');
      return;
    }
    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const res = await resetTeamPasswordWithPin(currentAccount.username, adminPin.trim(), newPassword);
    if (!res.success) {
      setError(res.error || 'Password update failed.');
      return;
    }

    setSuccess('Password updated successfully!');
    setAdminPin('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gray-950 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-tiger-gold/15 rounded-xl border border-tiger-gold/30 text-tiger-gold">
              <KeyRound size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase text-white tracking-wide">
                Account & Security
              </h2>
              <p className="text-[11px] text-gray-400">
                Manage credentials for @{currentAccount.username}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3 bg-gray-800/80 rounded-xl border border-gray-700 flex items-center justify-between">
            <div>
              <span className="text-white font-bold block">{currentAccount.teamName}</span>
              <span className="text-gray-400 text-[11px]">Username: @{currentAccount.username}</span>
            </div>
            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-700/50 text-red-300 font-bold text-xs rounded-lg transition-colors"
            >
              <LogOut size={13} />
              <span>Log Out</span>
            </button>
          </div>

          <form onSubmit={handleReset} className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="font-black uppercase text-gray-300 text-xs flex items-center gap-1.5">
                <Shield size={14} className="text-tiger-gold" />
                <span>Reset Account Password</span>
              </span>
              <span className="text-[10px] text-gray-500 font-mono">PIN Default: 1234</span>
            </div>

            {error && (
              <div className="p-2.5 bg-red-900/30 border border-red-700/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-2.5 bg-emerald-900/30 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 size={14} className="flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">
                Developer / Admin Master PIN
              </label>
              <input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Enter Admin PIN (Default: 1234)"
                className="w-full bg-black/60 border border-gray-700 px-3 py-2 rounded-xl text-white font-mono text-xs outline-none focus:border-tiger-gold"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 4 characters"
                className="w-full bg-black/60 border border-gray-700 px-3 py-2 rounded-xl text-white text-xs outline-none focus:border-tiger-gold"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-black/60 border border-gray-700 px-3 py-2 rounded-xl text-white text-xs outline-none focus:border-tiger-gold"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2.5 bg-tiger-gold hover:bg-yellow-400 text-black font-black uppercase text-xs rounded-xl transition-all shadow active:scale-95"
            >
              Update Password
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-950 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
