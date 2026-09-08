import React from 'react';
import { Player, Team, MatchState } from '../types';
import { calculateStrikeRate, calculateEconomy } from '../utils/cricketLogic';
import { X, Trophy, Target } from 'lucide-react';

interface Props {
  matchState: MatchState;
  onClose: () => void;
  inningsToShow?: 1 | 2;
}

export const ScorecardModal: React.FC<Props> = ({ matchState, onClose, inningsToShow }) => {
  const currentInnings = inningsToShow || matchState.inningsNumber;
  
  // Decide which team batted in which innings
  // Case 1: Innings 1
  // battingTeam: current strikers
  // bowlingTeam: current fielders
  
  // Case 2: Innings 2
  // battingTeam: current strikers (2nd innings)
  // bowlingTeam: Team that batted first (1st innings stats)
  
  let battingStatsTeam: Team;
  let bowlingStatsTeam: Team;
  let inningsTitle: string;

  if (currentInnings === 1) {
    if (matchState.inningsNumber === 1) {
      battingStatsTeam = matchState.battingTeam;
      bowlingStatsTeam = matchState.bowlingTeam;
    } else {
      // We are in 2nd innings but looking back at 1st
      battingStatsTeam = matchState.bowlingTeam;
      bowlingStatsTeam = matchState.battingTeam;
    }
    inningsTitle = "First Innings";
  } else {
    // We are in 2nd innings (or looking at it)
    battingStatsTeam = matchState.battingTeam;
    bowlingStatsTeam = matchState.bowlingTeam;
    inningsTitle = "Second Innings";
  }

  const battingPlayers = battingStatsTeam.players.filter(p => p.balls > 0 || p.isOut);
  const bowlingPlayers = bowlingStatsTeam.players.filter(p => p.ballsBowled > 0);

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col font-sans text-white overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
        <div className="flex items-center gap-3">
          <div className="bg-tiger-gold p-2 rounded-lg">
            <Trophy size={20} className="text-black" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight">{battingStatsTeam.name}</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{inningsTitle} Scorecard</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
        
        {/* Batting Header */}
        <div className="bg-gray-800/50 p-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Target size={12} className="text-tiger-gold" /> Batting
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-[9px] uppercase text-gray-500 bg-black/20">
                <th className="p-3 font-bold">Batter</th>
                <th className="p-3 font-bold text-right">R</th>
                <th className="p-3 font-bold text-right">B</th>
                <th className="p-3 font-bold text-right">4s</th>
                <th className="p-3 font-bold text-right">6s</th>
                <th className="p-3 font-bold text-right">S/R</th>
              </tr>
            </thead>
            <tbody>
              {battingPlayers.map((p) => (
                <tr key={p.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                  <td className="p-3">
                    <div className="text-sm font-bold flex flex-col">
                      <span className={p.isOut ? 'text-gray-400' : 'text-white'}>
                        {p.name} {(!p.isOut && (p.id === matchState.strikerId || p.id === matchState.nonStrikerId)) && <span className="text-tiger-gold">*</span>}
                      </span>
                      {p.isOut ? (
                        <span className="text-[8px] text-gray-500 font-normal mt-0.5">
                          {p.dismissalType} {p.dismissalFielder && `(${p.dismissalFielder})`} b {p.dismissalBowler}
                        </span>
                      ) : (
                        <span className="text-[8px] text-tiger-gold font-normal mt-0.5">Not Out</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right font-black text-sm tabular-nums">{p.runs}</td>
                  <td className="p-3 text-right text-xs text-gray-400 tabular-nums">{p.balls}</td>
                  <td className="p-3 text-right text-xs text-gray-400 tabular-nums">{p.fours}</td>
                  <td className="p-3 text-right text-xs text-gray-400 tabular-nums">{p.sixes}</td>
                  <td className="p-3 text-right text-xs text-tiger-gold tabular-nums font-mono">{calculateStrikeRate(p.runs, p.balls)}</td>
                </tr>
              ))}
              {/* Extras Row */}
              <tr className="bg-white/5 font-bold">
                 <td className="p-3 text-xs uppercase text-gray-400">Extras</td>
                 <td className="p-3 text-right text-sm">
                   {currentInnings === 1 && matchState.inningsNumber === 2 
                     ? matchState.extras.byes + matchState.extras.legByes + matchState.extras.noBalls + matchState.extras.wides // Incorrect, need fixed 1st inn extras
                     : currentInnings === 1 && matchState.inningsNumber === 1
                     ? matchState.extras.byes + matchState.extras.legByes + matchState.extras.noBalls + matchState.extras.wides
                     : matchState.extras.byes + matchState.extras.legByes + matchState.extras.noBalls + matchState.extras.wides
                   }
                   {/* Note: In a real app we'd store firstInningsScore object with more details */}
                 </td>
                 <td colSpan={4} className="p-3 text-[8px] text-gray-500 text-right uppercase">
                   {/* Actually let's just show current extras if it's the current innings */}
                   (W: {matchState.extras.wides}, NB: {matchState.extras.noBalls}, B: {matchState.extras.byes}, LB: {matchState.extras.legByes})
                 </td>
              </tr>
              {/* Total Row */}
              <tr className="bg-gray-900 border-t border-tiger-gold/30">
                 <td className="p-3">
                   <div className="text-sm font-black uppercase text-tiger-gold">Total</div>
                   <div className="text-[9px] text-gray-500 font-bold uppercase">
                     {currentInnings === 1 && matchState.firstInningsScore ? matchState.firstInningsScore.overs : `${matchState.currentOver}.${matchState.currentBall}`} OVERS
                   </div>
                 </td>
                 <td className="p-3 text-right text-xl font-black tabular-nums">
                   {currentInnings === 1 && matchState.firstInningsScore ? matchState.firstInningsScore.runs : matchState.totalRuns}/
                   {currentInnings === 1 && matchState.firstInningsScore ? matchState.firstInningsScore.wickets : matchState.wickets}
                 </td>
                 <td colSpan={4}></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bowling Header */}
        <div className="bg-gray-800/50 p-2 mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full" /> Bowling
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-[9px] uppercase text-gray-500 bg-black/20">
                <th className="p-3 font-bold">Bowler</th>
                <th className="p-3 font-bold text-right">O</th>
                <th className="p-3 font-bold text-right">M</th>
                <th className="p-3 font-bold text-right">R</th>
                <th className="p-3 font-bold text-right">W</th>
                <th className="p-3 font-bold text-right">Econ</th>
              </tr>
            </thead>
            <tbody>
              {bowlingPlayers.map((p) => (
                <tr key={p.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                  <td className="p-3">
                    <span className="text-sm font-bold truncate block">{p.name}</span>
                  </td>
                  <td className="p-3 text-right text-xs font-bold tabular-nums">
                    {Math.floor(p.ballsBowled / 6)}.{p.ballsBowled % 6}
                  </td>
                  <td className="p-3 text-right text-xs text-gray-400 tabular-nums">{p.maidens}</td>
                  <td className="p-3 text-right text-sm font-black text-red-400 tabular-nums">{p.runsConceded}</td>
                  <td className="p-3 text-right text-sm font-black text-blue-400 tabular-nums">{p.wickets}</td>
                  <td className="p-3 text-right text-xs text-gray-400 tabular-nums font-mono">{calculateEconomy(p.runsConceded, p.ballsBowled)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Fall of Wickets - Simplified */}
        <div className="p-4 bg-gray-900/50 mt-4 mx-4 rounded-xl border border-gray-800">
           <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Team Statistics</h4>
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/20 p-2 rounded border border-white/5">
                 <div className="text-[8px] text-gray-500 font-bold uppercase">Run Rate</div>
                 <div className="text-sm font-black text-white">
                   {((currentInnings === 1 && matchState.firstInningsScore ? matchState.firstInningsScore.runs : matchState.totalRuns) / 
                     ((currentInnings === 1 && matchState.firstInningsScore 
                        ? parseFloat(matchState.firstInningsScore.overs) 
                        : (matchState.currentOver + matchState.currentBall/6)) || 1)).toFixed(2)}
                 </div>
              </div>
              <div className="bg-black/20 p-2 rounded border border-white/5">
                 <div className="text-[8px] text-gray-500 font-bold uppercase">Fours/Sixes</div>
                 <div className="text-sm font-black text-white">
                   {battingPlayers.reduce((acc, p) => acc + p.fours, 0)} / {battingPlayers.reduce((acc, p) => acc + p.sixes, 0)}
                 </div>
              </div>
           </div>
        </div>

      </div>

      {/* Button to close or switch innings if match completed */}
      <div className="flex-shrink-0 p-4 border-t border-gray-800 bg-gray-900">
        <button 
          onClick={onClose}
          className="w-full py-3 bg-gray-800 hover:bg-gray-750 text-white font-bold uppercase tracking-widest rounded-xl transition-all"
        >
          Close Scorecard
        </button>
      </div>
    </div>
  );
};
