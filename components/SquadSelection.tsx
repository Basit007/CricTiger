import React, { useState } from 'react';
import { 
  CheckCircle2, 
  UserPlus, 
  Users, 
  ArrowLeft, 
  ArrowRight, 
  RotateCcw, 
  Sparkles, 
  AlertCircle, 
  UserCheck, 
  UserMinus,
  Shield
} from 'lucide-react';
import { SavedTeam } from '../types';

interface Props {
  homeTeam: SavedTeam;
  awayTeam: SavedTeam;
  onConfirm: (homeXI: string[], awayXI: string[], homeReserves: string[], awayReserves: string[]) => void;
  onBack: () => void;
}

export const SquadSelection: React.FC<Props> = ({ 
  homeTeam, 
  awayTeam, 
  onConfirm, 
  onBack 
}) => {
  // Initialize smart defaults: Top 11 playing + next 2 reserves for both teams
  const [homePlaying, setHomePlaying] = useState<string[]>(() => {
    return homeTeam.squad.slice(0, Math.min(11, homeTeam.squad.length));
  });
  const [homeReserves, setHomeReserves] = useState<string[]>(() => {
    return homeTeam.squad.slice(11, Math.min(13, homeTeam.squad.length));
  });

  const [awayPlaying, setAwayPlaying] = useState<string[]>(() => {
    return awayTeam.squad.slice(0, Math.min(11, awayTeam.squad.length));
  });
  const [awayReserves, setAwayReserves] = useState<string[]>(() => {
    return awayTeam.squad.slice(11, Math.min(13, awayTeam.squad.length));
  });

  const [activeTab, setActiveTab] = useState<'home' | 'away'>('home');
  const [filterView, setFilterView] = useState<'all' | 'playing' | 'reserves' | 'bench'>('all');
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null); // For swapping when XI is full

  const currentTeam = activeTab === 'home' ? homeTeam : awayTeam;
  const currentPlaying = activeTab === 'home' ? homePlaying : awayPlaying;
  const currentReserves = activeTab === 'home' ? homeReserves : awayReserves;
  const setCurrentPlaying = activeTab === 'home' ? setHomePlaying : setAwayPlaying;
  const setCurrentReserves = activeTab === 'home' ? setHomeReserves : setAwayReserves;

  // Set player as Playing XI
  const makePlaying = (player: string) => {
    if (currentPlaying.includes(player)) return;

    // If currently a reserve, remove from reserves
    if (currentReserves.includes(player)) {
      setCurrentReserves(currentReserves.filter(p => p !== player));
    }

    if (currentPlaying.length < 11) {
      setCurrentPlaying([...currentPlaying, player]);
      setReplaceTarget(null);
    } else {
      // Playing XI is already full (11 players). Open swap dialog for this player
      setReplaceTarget(player);
    }
  };

  // Swap a bench player with an existing playing player
  const swapPlayingPlayer = (outPlayer: string) => {
    if (!replaceTarget) return;
    const newPlaying = currentPlaying.map(p => p === outPlayer ? replaceTarget : p);
    setCurrentPlaying(newPlaying);
    setReplaceTarget(null);
  };

  // Set player as Reserve (Max 2)
  const makeReserve = (player: string) => {
    if (currentReserves.includes(player)) return;

    // If currently in playing XI, remove from playing XI
    if (currentPlaying.includes(player)) {
      setCurrentPlaying(currentPlaying.filter(p => p !== player));
    }

    if (currentReserves.length < 2) {
      setCurrentReserves([...currentReserves, player]);
    } else {
      // Reserves full (2 max) - replace the second reserve or prompt
      alert(`Maximum 2 reserves allowed. Please bench one of your current reserves (${currentReserves.join(', ')}) first.`);
    }
  };

  // Move player to Bench (remove from both Playing XI and Reserves)
  const makeBench = (player: string) => {
    if (currentPlaying.includes(player)) {
      setCurrentPlaying(currentPlaying.filter(p => p !== player));
    }
    if (currentReserves.includes(player)) {
      setCurrentReserves(currentReserves.filter(p => p !== player));
    }
    if (replaceTarget === player) {
      setReplaceTarget(null);
    }
  };

  // Auto-pick first 11 as Playing, next 2 as Reserves
  const handleAutoPick = () => {
    const squad = currentTeam.squad;
    const newPlaying = squad.slice(0, Math.min(11, squad.length));
    const newReserves = squad.slice(11, Math.min(13, squad.length));
    setCurrentPlaying(newPlaying);
    setCurrentReserves(newReserves);
    setReplaceTarget(null);
  };

  // Clear all selections for current team
  const handleClear = () => {
    setCurrentPlaying([]);
    setCurrentReserves([]);
    setReplaceTarget(null);
  };

  // Validation before proceeding
  const handleConfirm = () => {
    if (homePlaying.length !== 11) {
      setActiveTab('home');
      alert(`${homeTeam.name} must have exactly 11 playing players. (Currently: ${homePlaying.length}/11)`);
      return;
    }
    if (awayPlaying.length !== 11) {
      setActiveTab('away');
      alert(`${awayTeam.name} must have exactly 11 playing players. (Currently: ${awayPlaying.length}/11)`);
      return;
    }
    if (homeReserves.length > 2) {
      setActiveTab('home');
      alert(`${homeTeam.name} cannot have more than 2 reserves.`);
      return;
    }
    if (awayReserves.length > 2) {
      setActiveTab('away');
      alert(`${awayTeam.name} cannot have more than 2 reserves.`);
      return;
    }

    onConfirm(homePlaying, awayPlaying, homeReserves, awayReserves);
  };

  // Filtered players list
  const filteredPlayers = currentTeam.squad.filter(player => {
    const isPlaying = currentPlaying.includes(player);
    const isReserve = currentReserves.includes(player);
    if (filterView === 'playing') return isPlaying;
    if (filterView === 'reserves') return isReserve;
    if (filterView === 'bench') return !isPlaying && !isReserve;
    return true;
  });

  const isHomeReady = homePlaying.length === 11;
  const isAwayReady = awayPlaying.length === 11;

  return (
    <div className="flex flex-col h-full bg-tiger-black text-white p-3 sm:p-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <button 
            onClick={onBack} 
            className="p-2 rounded-xl bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-tiger-gold uppercase tracking-tight flex items-center gap-2">
              <span>Squad Selection</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-tiger-gold/15 text-tiger-gold border border-tiger-gold/30 font-bold lowercase">
                11 playing + 2 reserves
              </span>
            </h2>
            <p className="text-gray-400 text-xs">Configure the playing XI and reserves for both sides.</p>
          </div>
        </div>

        <button
          onClick={handleAutoPick}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-tiger-gold font-bold transition-all shadow-sm"
          title="Auto-select first 11 as Playing and next 2 as Reserves"
        >
          <Sparkles size={14} />
          <span>Auto-Pick Top 11+2</span>
        </button>
      </div>

      {/* Team Tabs Switcher */}
      <div className="flex gap-2 mb-3 bg-gray-900/90 p-1 rounded-xl border border-gray-800 flex-shrink-0">
        <button 
          onClick={() => { setActiveTab('home'); setReplaceTarget(null); }}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between ${
            activeTab === 'home' 
              ? 'bg-tiger-gold text-black shadow-md' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <span>{homeTeam.logoUrl || '🏏'}</span>
            <span className="truncate">{homeTeam.name}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
              activeTab === 'home' ? 'bg-black/20 text-black' : 'bg-gray-800 text-gray-300'
            }`}>
              {homePlaying.length}/11
            </span>
            {isHomeReady && <CheckCircle2 size={14} className={activeTab === 'home' ? 'text-black' : 'text-green-400'} />}
          </div>
        </button>

        <button 
          onClick={() => { setActiveTab('away'); setReplaceTarget(null); }}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between ${
            activeTab === 'away' 
              ? 'bg-tiger-gold text-black shadow-md' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <span>{awayTeam.logoUrl || '🏏'}</span>
            <span className="truncate">{awayTeam.name}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
              activeTab === 'away' ? 'bg-black/20 text-black' : 'bg-gray-800 text-gray-300'
            }`}>
              {awayPlaying.length}/11
            </span>
            {isAwayReady && <CheckCircle2 size={14} className={activeTab === 'away' ? 'text-black' : 'text-green-400'} />}
          </div>
        </button>
      </div>

      {/* Counters & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between bg-gray-900/80 px-3.5 py-2.5 rounded-xl border border-gray-800 mb-3 flex-shrink-0">
        <div className="flex items-center gap-3 text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 uppercase text-[10px]">Playing XI:</span>
            <span className={`px-2 py-0.5 rounded-md font-mono text-xs ${
              currentPlaying.length === 11 
                ? 'bg-green-900/40 text-green-300 border border-green-700/50' 
                : 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50'
            }`}>
              {currentPlaying.length} / 11
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 uppercase text-[10px]">Reserves:</span>
            <span className="px-2 py-0.5 rounded-md font-mono text-xs bg-blue-900/40 text-blue-300 border border-blue-700/50">
              {currentReserves.length} / 2
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-gray-400 uppercase text-[10px]">Bench:</span>
            <span className="text-gray-400 font-mono text-xs">
              {Math.max(0, currentTeam.squad.length - currentPlaying.length - currentReserves.length)}
            </span>
          </div>
        </div>

        {/* Filters and quick action */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-800">
          <div className="flex gap-1">
            {(['all', 'playing', 'reserves', 'bench'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterView(f)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                  filterView === f 
                    ? 'bg-gray-700 text-white shadow-sm' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={handleClear}
            className="text-[10px] text-gray-400 hover:text-red-400 font-bold uppercase px-2 py-1 transition-colors"
            title="Clear all selections"
          >
            Clear
          </button>
        </div>
      </div>

      {/* SWAP MODAL / BANNER when Playing XI is full (11) and user wants to add another player */}
      {replaceTarget && (
        <div className="mb-3 p-3 bg-tiger-gold/10 border border-tiger-gold/40 rounded-xl flex-shrink-0 animate-fadeIn">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-tiger-gold">
              <AlertCircle size={15} />
              <span>Playing XI is full (11/11). Tap a player below to replace with <span className="text-white underline">{replaceTarget}</span>:</span>
            </div>
            <button 
              onClick={() => setReplaceTarget(null)}
              className="text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded bg-gray-800"
            >
              Cancel
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {currentPlaying.map((p, idx) => (
              <button
                key={p}
                onClick={() => swapPlayingPlayer(p)}
                className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-tiger-gold hover:text-black border border-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <span className="text-[10px] text-gray-400">#{idx + 1}</span>
                <span>{p}</span>
                <span className="text-[10px] text-red-400">⇄ Replace</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Roster / Squad List */}
      <div className="flex-1 overflow-y-auto space-y-2 bg-gray-900/40 p-2 sm:p-3 rounded-2xl border border-gray-800/80 no-scrollbar">
        {filteredPlayers.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-xs font-bold">
            No players match the &quot;{filterView}&quot; filter.
          </div>
        ) : (
          filteredPlayers.map((player, idx) => {
            const playingIndex = currentPlaying.indexOf(player);
            const isPlaying = playingIndex !== -1;
            const reserveIndex = currentReserves.indexOf(player);
            const isReserve = reserveIndex !== -1;
            const isBench = !isPlaying && !isReserve;

            return (
              <div
                key={player + '_' + idx}
                className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                  isPlaying
                    ? 'bg-tiger-gold/10 border-tiger-gold/50 shadow-sm'
                    : isReserve
                    ? 'bg-blue-900/20 border-blue-500/40'
                    : 'bg-gray-800/40 border-gray-800 hover:border-gray-700'
                }`}
              >
                {/* Player Identification & Status Indicator */}
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs flex-shrink-0 ${
                    isPlaying 
                      ? 'bg-tiger-gold text-black font-black' 
                      : isReserve 
                      ? 'bg-blue-600 text-white font-bold' 
                      : 'bg-gray-800 text-gray-500'
                  }`}>
                    {isPlaying ? `#${playingIndex + 1}` : isReserve ? `R${reserveIndex + 1}` : '-'}
                  </div>

                  <div className="overflow-hidden">
                    <p className="font-bold text-white text-sm truncate">{player}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isPlaying && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-tiger-gold">
                          Playing XI
                        </span>
                      )}
                      {isReserve && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-blue-400">
                          Reserve {reserveIndex + 1}
                        </span>
                      )}
                      {isBench && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
                          Bench
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Role Action Controls */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Playing XI Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isPlaying) {
                        makeBench(player);
                      } else {
                        makePlaying(player);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                      isPlaying
                        ? 'bg-tiger-gold text-black shadow'
                        : currentPlaying.length >= 11
                        ? 'bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700'
                        : 'bg-gray-800 hover:bg-tiger-gold hover:text-black text-gray-300 border border-gray-700'
                    }`}
                    title={isPlaying ? 'Remove from Playing XI' : 'Add to Playing XI'}
                  >
                    <UserCheck size={13} />
                    <span>{isPlaying ? 'Playing' : currentPlaying.length >= 11 ? 'Swap In' : 'Play'}</span>
                  </button>

                  {/* Reserve Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isReserve) {
                        makeBench(player);
                      } else {
                        makeReserve(player);
                      }
                    }}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                      isReserve
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-gray-800 hover:bg-blue-900/40 hover:text-blue-300 text-gray-400 border border-gray-700'
                    }`}
                    title={isReserve ? 'Remove from Reserves' : 'Add as Reserve'}
                  >
                    <UserPlus size={13} />
                    <span className="hidden sm:inline">{isReserve ? 'Reserve' : 'Reserve'}</span>
                  </button>

                  {/* Bench / Remove button if in either Playing or Reserve */}
                  {(isPlaying || isReserve) && (
                    <button
                      type="button"
                      onClick={() => makeBench(player)}
                      className="p-1.5 rounded-lg bg-gray-800/80 hover:bg-red-900/40 text-gray-400 hover:text-red-300 transition-colors border border-gray-700"
                      title="Move to bench"
                    >
                      <UserMinus size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Controls */}
      <div className="mt-3 pt-2 border-t border-gray-800 flex items-center gap-3 flex-shrink-0">
        <button 
          onClick={onBack} 
          className="py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
        >
          Back
        </button>

        {/* Prompt to switch tab if current is complete but other is not */}
        {activeTab === 'home' && isHomeReady && !isAwayReady && (
          <button
            onClick={() => { setActiveTab('away'); setReplaceTarget(null); }}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg transition-all"
          >
            <span>Configure {awayTeam.name} Squad</span>
            <ArrowRight size={15} />
          </button>
        )}

        {/* Confirm Squads Button */}
        {(!isHomeReady || !isAwayReady || activeTab === 'away') && (
          <button 
            onClick={handleConfirm}
            disabled={!isHomeReady || !isAwayReady}
            className="flex-1 py-3 bg-gradient-to-r from-tiger-gold to-tiger-orange hover:from-yellow-400 hover:to-orange-500 text-black rounded-xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <CheckCircle2 size={16} />
            <span>Confirm Squads ({isHomeReady && isAwayReady ? 'Both Ready' : `${homePlaying.length}/11 & ${awayPlaying.length}/11`})</span>
          </button>
        )}
      </div>
    </div>
  );
};
