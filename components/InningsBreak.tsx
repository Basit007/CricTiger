import React from 'react';
import { MatchState } from '../types';
import { ArrowRight } from 'lucide-react';

interface Props {
  matchState: MatchState;
  onStartSecondInnings: () => void;
}

export const InningsBreak: React.FC<Props> = ({ matchState, onStartSecondInnings }) => {
  const { firstInningsScore, target, bowlingTeam } = matchState;

  return (
    <div className="flex flex-col h-full bg-tiger-black text-white items-center justify-center p-8">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl text-center">
        <h2 className="text-2xl font-bold text-gray-400 uppercase tracking-widest mb-2">Innings Break</h2>
        
        <div className="my-8">
          <div className="text-xl font-bold text-white mb-2">{firstInningsScore?.teamName}</div>
          <div className="text-6xl font-black text-tiger-gold">{firstInningsScore?.runs}/{firstInningsScore?.wickets}</div>
          <div className="text-gray-500 mt-2">{firstInningsScore?.overs} Overs</div>
        </div>

        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-8">
           <div className="text-sm text-gray-400 mb-1">Target for {bowlingTeam.name}</div>
           <div className="text-3xl font-bold text-white">{target} <span className="text-sm font-normal text-gray-500">runs to win</span></div>
        </div>

        <button 
          onClick={onStartSecondInnings}
          className="w-full py-4 bg-gradient-to-r from-tiger-gold to-tiger-orange text-black font-bold uppercase rounded-xl shadow-lg hover:brightness-110 flex items-center justify-center gap-2"
        >
          Start 2nd Innings <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};