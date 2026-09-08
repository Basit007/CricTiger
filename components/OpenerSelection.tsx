import React, { useState } from 'react';
import { Player } from '../types';

interface Props {
  battingTeamName: string;
  bowlingTeamName: string;
  battingPlayers: Player[];
  bowlingPlayers: Player[];
  onStart: (strikerId: string, nonStrikerId: string, bowlerId: string) => void;
  inningsNumber: 1 | 2;
}

export const OpenerSelection: React.FC<Props> = ({ 
  battingTeamName, bowlingTeamName, battingPlayers, bowlingPlayers, onStart, inningsNumber 
}) => {
  const [strikerId, setStrikerId] = useState<string>('');
  const [nonStrikerId, setNonStrikerId] = useState<string>('');
  const [bowlerId, setBowlerId] = useState<string>('');

  const isValid = strikerId && nonStrikerId && bowlerId && strikerId !== nonStrikerId;

  // Filter out players who are already out (for innings 1 everyone is not out, but good practice)
  const availableBatters = battingPlayers.filter(p => !p.isOut);

  return (
    <div className="flex flex-col h-full bg-tiger-black text-white p-6 justify-center">
      <div className="max-w-md mx-auto w-full space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-black text-tiger-gold uppercase tracking-wider">
            Start Innings {inningsNumber}
          </h2>
          <p className="text-gray-400">Select opening players</p>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
             <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">{battingTeamName} Batters</h3>
             <div className="space-y-3">
               <div>
                 <label className="text-xs text-tiger-gold font-bold">Striker</label>
                 <select 
                    value={strikerId} 
                    onChange={(e) => setStrikerId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-3 mt-1 outline-none focus:border-tiger-gold"
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
                    className="w-full bg-gray-900 border border-gray-600 rounded p-3 mt-1 outline-none focus:border-tiger-gold"
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
             <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">{bowlingTeamName} Bowler</h3>
             <div>
                 <label className="text-xs text-white font-bold">Opening Bowler</label>
                 <select 
                    value={bowlerId} 
                    onChange={(e) => setBowlerId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-3 mt-1 outline-none focus:border-white"
                 >
                   <option value="">Select Bowler</option>
                   {bowlingPlayers.map(p => (
                     <option key={p.id} value={p.id}>{p.name}</option>
                   ))}
                 </select>
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