import React, { useState } from 'react';
import { ArrowLeft, Trophy } from 'lucide-react';

interface Props {
  homeTeam: string;
  awayTeam: string;
  onTossComplete: (winner: string, decision: 'bat' | 'bowl') => void;
  onBack: () => void;
}

export const TossScreen: React.FC<Props> = ({ homeTeam, awayTeam, onTossComplete, onBack }) => {
  const [winner, setWinner] = useState<string | null>(null);
  const [decision, setDecision] = useState<'bat' | 'bowl' | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [rotation, setRotation] = useState(0);

  // CSS for 3D effect injected locally
  const styles = `
    .perspective-1000 { perspective: 1000px; }
    .preserve-3d { transform-style: preserve-3d; }
    .backface-hidden { backface-visibility: hidden; }
    .rotate-y-180 { transform: rotateY(180deg); }
    .coin-shine {
      background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.4) 100%);
    }
  `;

  const handleVirtualFlip = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setWinner(null);
    setDecision(null);

    // Random winner: 0 = Home, 1 = Away
    const result = Math.random() < 0.5 ? 'home' : 'away';
    
    // Calculate rotation: 
    // We want at least 5 to 8 full spins + landing position.
    // Each full spin is 360deg. Landing on Home is 0 (or multiple of 360). Landing on Away is 180 (or multiple of 360 + 180).
    const spins = 5 + Math.floor(Math.random() * 5); // 5 to 9 spins
    const targetDeg = (spins * 360) + (result === 'home' ? 0 : 180);
    
    setRotation(targetDeg);

    // Duration matches the CSS transition
    setTimeout(() => {
      setIsFlipping(false);
      setWinner(result === 'home' ? homeTeam : awayTeam);
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(50);
    }, 3200); // Slightly more than transition to ensure landing
  };

  const handleManualSelect = (team: string) => {
    setWinner(team);
    // Orient coin to match manual selection without spinning
    const isHome = team === homeTeam;
    setRotation(prev => {
        // Find nearest 360 multiple for smooth transition, though manual is instant
        return isHome ? Math.ceil(prev / 360) * 360 : Math.ceil(prev / 360) * 360 + 180;
    });
  };

  const canStart = winner && decision;

  return (
    <div className="flex flex-col h-full bg-tiger-black text-white relative">
      <style>{styles}</style>
      
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-gray-800 to-transparent opacity-50 pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center p-4 z-10 bg-tiger-black/50 backdrop-blur-sm sticky top-0">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-800 transition-colors">
          <ArrowLeft size={24} className="text-gray-400" />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold uppercase tracking-widest text-tiger-gold">Match Toss</h1>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <div className="flex-1 flex flex-col items-center overflow-y-auto p-6 z-10 no-scrollbar">
        
        {/* --- 3D COIN STAGE --- */}
        <div className="perspective-1000 w-40 h-40 sm:w-48 sm:h-48 mb-8 relative group cursor-pointer mt-4 flex-shrink-0" onClick={handleVirtualFlip}>
          <div 
            className="w-full h-full relative preserve-3d transition-transform duration-[3000ms] ease-out-quart"
            style={{ transform: `rotateY(${rotation}deg)` }}
          >
            {/* HEADS (HOME) */}
            <div className="absolute inset-0 backface-hidden rounded-full border-4 border-yellow-600 bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-2xl flex flex-col items-center justify-center text-center p-2">
              <div className="absolute inset-0 rounded-full coin-shine pointer-events-none" />
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-black/10 flex items-center justify-center mb-2 border border-yellow-700/30">
                 <Trophy size={32} className="text-yellow-900 drop-shadow-sm sm:w-10 sm:h-10" />
              </div>
              <span className="text-xs font-black text-yellow-900 uppercase tracking-wider line-clamp-1 px-2">{homeTeam}</span>
              <span className="text-[10px] font-bold text-yellow-800 uppercase mt-1">Heads</span>
            </div>

            {/* TAILS (AWAY) */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-full border-4 border-slate-500 bg-gradient-to-br from-slate-300 to-slate-500 shadow-2xl flex flex-col items-center justify-center text-center p-2">
              <div className="absolute inset-0 rounded-full coin-shine pointer-events-none" />
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-black/10 flex items-center justify-center mb-2 border border-slate-600/30">
                 <span className="text-3xl sm:text-4xl font-black text-slate-700">VS</span>
              </div>
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider line-clamp-1 px-2">{awayTeam}</span>
              <span className="text-[10px] font-bold text-slate-700 uppercase mt-1">Tails</span>
            </div>
          </div>
          
          {/* Shadow */}
          <div className={`absolute -bottom-10 left-1/2 -translate-x-1/2 w-24 h-4 bg-black/50 blur-xl rounded-[100%] transition-all duration-[3000ms] ${isFlipping ? 'scale-50 opacity-20' : 'scale-100 opacity-100'}`} />
        </div>

        {/* --- STATUS TEXT & FLIP BUTTON --- */}
        <div className="text-center min-h-[60px] mb-4 w-full">
          {isFlipping ? (
            <p className="text-tiger-gold text-lg font-bold animate-pulse">Flipping coin...</p>
          ) : winner ? (
            <div className="animate-in zoom-in duration-300">
               <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Toss Winner</p>
               <p className="text-2xl sm:text-3xl font-black text-white bg-clip-text bg-gradient-to-r from-white to-gray-400 text-transparent break-words">
                 {winner}
               </p>
            </div>
          ) : (
             <button 
               onClick={handleVirtualFlip}
               className="bg-tiger-gold text-black px-8 py-3 rounded-full font-black uppercase tracking-widest shadow-[0_0_20px_rgba(251,191,36,0.4)] hover:scale-105 active:scale-95 transition-all"
             >
               Flip Coin
             </button>
          )}
        </div>

        {/* --- MANUAL OVERRIDE (Only if no winner selected via flip yet, or to correct) --- */}
        {!isFlipping && (
          <div className={`w-full max-w-sm space-y-4 transition-all duration-500 ${winner ? 'opacity-100' : 'opacity-100'}`}>
            
            {/* Step 1: Manual Select (Subtle if winner exists) */}
            {!winner && (
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleManualSelect(homeTeam)} className="p-3 rounded-xl border border-gray-700 hover:bg-gray-800 text-gray-400 text-xs font-bold uppercase">
                  Manual: {homeTeam}
                </button>
                <button onClick={() => handleManualSelect(awayTeam)} className="p-3 rounded-xl border border-gray-700 hover:bg-gray-800 text-gray-400 text-xs font-bold uppercase">
                  Manual: {awayTeam}
                </button>
              </div>
            )}

            {/* Step 2: Decision (Only appears after winner) */}
            {winner && (
              <div className="animate-in slide-in-from-bottom-10 fade-in duration-500 bg-gray-800/50 p-6 rounded-2xl border border-gray-700 shadow-xl">
                 <p className="text-center text-gray-300 text-sm mb-4">
                   What did they choose?
                 </p>
                 <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setDecision('bat')}
                      className={`py-4 rounded-xl font-bold uppercase tracking-wider border-2 transition-all flex flex-col items-center gap-1 ${
                        decision === 'bat' 
                        ? 'bg-blue-600 border-blue-400 text-white shadow-lg scale-105' 
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:bg-gray-750'
                      }`}
                    >
                      <span>Bat</span>
                      {decision === 'bat' && <div className="w-1.5 h-1.5 rounded-full bg-white mt-1" />}
                    </button>
                    <button 
                      onClick={() => setDecision('bowl')}
                      className={`py-4 rounded-xl font-bold uppercase tracking-wider border-2 transition-all flex flex-col items-center gap-1 ${
                        decision === 'bowl' 
                        ? 'bg-blue-600 border-blue-400 text-white shadow-lg scale-105' 
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:bg-gray-750'
                      }`}
                    >
                       <span>Bowl</span>
                       {decision === 'bowl' && <div className="w-1.5 h-1.5 rounded-full bg-white mt-1" />}
                    </button>
                 </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- START MATCH FOOTER --- */}
      <div className="p-6 bg-gray-900 border-t border-gray-800 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        <button 
          disabled={!canStart}
          onClick={() => canStart && onTossComplete(winner!, decision!)}
          className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${
            canStart 
            ? 'bg-gradient-to-r from-tiger-gold to-tiger-orange text-black hover:brightness-110 transform hover:-translate-y-1' 
            : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
          }`}
        >
          {canStart ? 'Start Match' : 'Select Decision to Start'}
        </button>
      </div>

    </div>
  );
};