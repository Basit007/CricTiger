import React, { useState } from 'react';
import { Player } from '../types';
import { getMaxBowlerOvers, getPowerplayOvers } from '../utils/cricketLogic';
import { Zap, Target } from 'lucide-react';

interface Props {
  battingTeamName: string;
  bowlingTeamName: string;
  battingPlayers: Player[];
  bowlingPlayers: Player[];
  onStart: (strikerId: string, nonStrikerId: string, bowlerId: string) => void;
  inningsNumber: 1 | 2;
  totalOvers?: number;
}

export const OpenerSelection: React.FC<Props> = ({ 
  battingTeamName, bowlingTeamName, battingPlayers, bowlingPlayers, onStart, inningsNumber, totalOvers = 20 
}) => {
  const [strikerId, setStrikerId] = useState<string>('');
  const [nonStrikerId, setNonStrikerId] = useState<string>('');
  const [bowlerId, setBowlerId] = useState<string>('');

  const maxBowlerOvers = getMaxBowlerOvers(totalOvers);
  const powerplayOvers = getPowerplayOvers(totalOvers);

  const isValid = strikerId && nonStrikerId && bowlerId && strikerId !== nonStrikerId;

  // Filter out players who are already out (for innings 1 everyone is not out, but good practice)
  const availableBatters = battingPlayers.filter(p => !p.isOut);

  return (
    <div className="flex flex-col h-full bg-tiger-black text-white p-6 justify-center overflow-y-auto no-scrollbar">
      <div className="max-w-md mx-auto w-full space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-black text-tiger-gold uppercase tracking-wider">
            Start Innings {inningsNumber}
          </h2>
          <p className="text-gray-400 text-xs mt-0.5">Select opening batsmen and opening bowler</p>
          
          {/* Format info badges */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] px-2.5 py-1 rounded-full font-bold">
              <Zap size={11} className="fill-amber-300" /> Powerplay: Overs 1–{powerplayOvers}
            </span>
            <span className="flex items-center gap-1 bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] px-2.5 py-1 rounded-full font-bold">
              <Target size={11} /> Limit: {maxBowlerOvers} ov/bowler
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
             <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">{battingTeamName} Batters</h3>
             <div className="space-y-3">
               <div>
                 <label className="text-xs text-tiger-gold font-bold">Striker</label>
                 <select 
                    value={strikerId} 
                    onChange={(e) => setStrikerId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-3 mt-1 outline-none focus:border-tiger-gold text-sm"
                 >
                   <option value="">Select Striker</option>
                   {availableBatters.map(p => (
                     <option key={p.id} value={p.id} disabled={p.id === nonStrikerId}>{p.name}</option>
                   ))}
                 </select>
               </div>
               <div>
                 <label className="text-xs text-tiger-gold font-bold">Non-Striker</label>
                 <select 
                    value={nonStrikerId} 
                    onChange={(e) => setNonStrikerId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-3 mt-1 outline-none focus:border-tiger-gold text-sm"
                 >
                   <option value="">Select Non-Striker</option>
                   {availableBatters.map(p => (
                     <option key={p.id} value={p.id} disabled={p.id === strikerId}>{p.name}</option>
                   ))}
                 </select>
               </div>
             </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
             <div className="flex justify-between items-center mb-3">
               <h3 className="text-sm font-bold text-gray-400 uppercase">{bowlingTeamName} Bowler</h3>
               <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                 Quota: {maxBowlerOvers} overs
               </span>
             </div>
             <div>
                 <label className="text-xs text-white font-bold">Opening Bowler (Over 1)</label>
                 <select 
                    value={bowlerId} 
                    onChange={(e) => setBowlerId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-3 mt-1 outline-none focus:border-white text-sm"
                 >
                   <option value="">Select Bowler</option>
                   {bowlingPlayers.map(p => (
                     <option key={p.id} value={p.id}>{p.name} (0/{maxBowlerOvers} ov bowled)</option>
                   ))}
                 </select>
                 <p className="text-[10px] text-gray-500 mt-1.5">
                   Law 17.8: Bowler who completes Over 1 cannot bowl Over 2 consecutively.
                 </p>
               </div>
          </div>
        </div>

        <button 
          disabled={!isValid}
          onClick={() => isValid && onStart(strikerId, nonStrikerId, bowlerId)}
          className={`w-full py-4 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all ${isValid ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
        >
          Start Play
        </button>
      </div>
    </div>
  );
};