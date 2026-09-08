import React, { useState, useEffect } from 'react';
import { Trophy, BarChart2, Users, Settings, LogOut, PlusCircle, Shield } from 'lucide-react';
import { getSavedTeams } from '../utils/storage';
import { SavedTeam, TeamAccount } from '../types';
import { AppLogo } from './AppLogo';

interface Props {
  currentAccount: TeamAccount;
  onNext: (home: SavedTeam, away: SavedTeam, overs: number) => void;
  onViewStats: () => void;
  onManageTeams: () => void;
  onContinue?: () => void;
  onLogout: () => void;
  hasDraft?: boolean;
}

export const MatchSetup: React.FC<Props> = ({
  currentAccount,
  onNext,
  onViewStats,
  onManageTeams,
  onContinue,
  onLogout,
  hasDraft = false,
}) => {
  const [teams, setTeams] = useState<SavedTeam[]>([]);
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [overs, setOvers] = useState(20);

  useEffect(() => {
    const saved = getSavedTeams(currentAccount.id);
    setTeams(saved);
    
    // Automatically match the home team with the current account's registered team
    const myHomeTeam = saved.find(t => t.name.toLowerCase() === currentAccount.teamName.toLowerCase()) || saved[0];
    if (myHomeTeam) {
      setHomeTeamId(myHomeTeam.id);
      // Select the first opponent team if available
      const opponent = saved.find(t => t.id !== myHomeTeam.id);
      if (opponent) setAwayTeamId(opponent.id);
    } else if (saved.length > 0) {
      setHomeTeamId(saved[0].id);
      if (saved.length > 1) setAwayTeamId(saved[1].id);
    }
  }, [currentAccount]);

  const handleNext = () => {
    const home = teams.find(t => t.id === homeTeamId);
    const away = teams.find(t => t.id === awayTeamId);

    if (!home || !away) return alert('Please select both teams.');
    if (home.id === away.id) return alert('Please select different teams for home and away.');

    onNext(home, away, overs);
  };

  return (
    <div className="flex flex-col h-full bg-tiger-black text-white overflow-y-auto no-scrollbar">
      <div className="p-4 max-w-lg mx-auto w-full flex flex-col min-h-full justify-center">
        
        {/* Top Logged-in Team Account Bar */}
        <div className="flex items-center justify-between bg-gray-900/90 border border-gray-800 p-2.5 rounded-xl mb-4 shadow-sm">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-tiger-gold/15 border border-tiger-gold/30 flex items-center justify-center text-base flex-shrink-0">
              {currentAccount.logoUrl || '🏏'}
            </div>
            <div className="leading-tight overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white truncate">{currentAccount.teamName}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-tiger-gold/20 text-tiger-gold font-bold uppercase">Club</span>
              </div>
              <p className="text-[10px] text-gray-400 truncate">@{currentAccount.username} {currentAccount.city ? `• ${currentAccount.city}` : ''}</p>
            </div>
          </div>

          <button
            onClick={() => {
              if (confirm(`Log out from ${currentAccount.teamName}?`)) {
                onLogout();
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-300 hover:text-red-300 text-[11px] font-bold transition-all border border-gray-700 flex-shrink-0"
            title="Log out or switch team"
          >
            <LogOut size={13} />
            <span>Switch</span>
          </button>
        </div>

        {/* Branding Header */}
        <div className="flex flex-col items-center mb-5 pt-1">
          <div className="mb-2 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]">
            <AppLogo size={80} />
          </div>
          <h1 className="text-3xl font-black text-center text-white italic uppercase tracking-tighter">
            Cric<span className="text-tiger-gold">Tiger</span>
          </h1>
          <p className="text-gray-500 text-[10px] tracking-widest uppercase">Professional Match Setup</p>
        </div>

        {/* Action Buttons: Stats & Teams */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button 
            onClick={onViewStats}
            className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white py-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all shadow-md group"
          >
            <BarChart2 size={20} className="text-tiger-gold group-hover:scale-110 transition-transform" /> 
            <span className="text-[10px] font-bold uppercase">{currentAccount.teamName} Stats</span>
          </button>
          <button 
            onClick={onManageTeams}
            className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white py-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all shadow-md group"
          >
            <Users size={20} className="text-blue-400 group-hover:scale-110 transition-transform" /> 
            <span className="text-[10px] font-bold uppercase">Manage Squads</span>
          </button>
        </div>

        <div className="space-y-4 bg-gray-900/50 p-5 rounded-2xl border border-gray-800 shadow-lg">
          {/* Draft Recovery */}
          {hasDraft && onContinue && (
            <button 
              onClick={onContinue}
              className="w-full bg-blue-600/20 border border-blue-500/50 text-blue-300 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600/30 transition-all group"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-25" />
                <Settings size={18} className="relative z-10" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest">Continue Saved Match</span>
            </button>
          )}

          {/* Team Selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                <span>Home Team</span>
                <span className="text-tiger-gold text-[9px]">(Your Team)</span>
              </label>
              <select 
                value={homeTeamId}
                onChange={(e) => setHomeTeamId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white p-2 rounded-lg outline-none focus:border-tiger-gold text-sm appearance-none font-medium"
              >
                <option value="" disabled>Select Team</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.name.toLowerCase() === currentAccount.teamName.toLowerCase() ? '★' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">
                Away / Opponent
              </label>
              <select 
                value={awayTeamId}
                onChange={(e) => setAwayTeamId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white p-2 rounded-lg outline-none focus:border-tiger-gold text-sm appearance-none font-medium"
              >
                <option value="" disabled>Select Opponent</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id} disabled={t.id === homeTeamId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {teams.length < 2 && (
            <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg text-yellow-400 text-xs text-center flex flex-col gap-1.5 items-center">
              <span>You need an opponent team to start a match.</span>
              <button 
                onClick={onManageTeams} 
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-tiger-gold text-black font-black text-xs uppercase"
              >
                <PlusCircle size={14} />
                <span>Create Opponent Team</span>
              </button>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Match Overs</label>
            <div className="flex gap-1.5">
              {[5, 10, 20, 50].map(val => (
                <button 
                  key={val}
                  onClick={() => setOvers(val)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                    overs === val 
                      ? 'bg-tiger-gold text-black border-tiger-gold' 
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  {val}
                </button>
              ))}
              <input 
                type="number"
                value={overs}
                onChange={(e) => setOvers(Number(e.target.value))}
                className="w-12 bg-gray-800 border border-gray-700 text-white text-center rounded-lg outline-none focus:border-tiger-gold font-bold text-xs"
              />
            </div>
          </div>

          <button 
            disabled={teams.length < 2 || !homeTeamId || !awayTeamId}
            onClick={handleNext}
            className="w-full mt-2 bg-gradient-to-r from-tiger-gold to-tiger-orange hover:from-yellow-400 hover:to-orange-500 text-black font-black uppercase tracking-widest py-3 rounded-xl shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
          >
            <Trophy size={16} />
            <span>Proceed to Squad Selection</span>
          </button>
        </div>

      </div>
    </div>
  );
};
