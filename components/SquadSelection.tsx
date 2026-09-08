import React, { useState } from 'react';
import { CheckCircle2, Circle, UserPlus, Users } from 'lucide-react';
import { SavedTeam } from '../types';

interface Props {
  homeTeam: SavedTeam;
  awayTeam: SavedTeam;
  onConfirm: (homeXI: string[], awayXI: string[], homeReserves: string[], awayReserves: string[]) => void;
  onBack: () => void;
}

export const SquadSelection: React.FC<Props> = ({ 
  homeTeam, awayTeam, onConfirm, onBack 
}) => {
  // State stores arrays of player names
  const [homePlaying, setHomePlaying] = useState<string[]>([]);
  const [homeReserves, setHomeReserves] = useState<string[]>([]);
  
  const [awayPlaying, setAwayPlaying] = useState<string[]>([]);
  const [awayReserves, setAwayReserves] = useState<string[]>([]);
  
  const [activeTab, setActiveTab] = useState<'home' | 'away'>('home');

  const toggleSelection = (player: string, isHome: boolean) => {
    const playing = isHome ? homePlaying : awayPlaying;
    const reserves = isHome ? homeReserves : awayReserves;
    const setPlaying = isHome ? setHomePlaying : setAwayPlaying;
    const setReserves = isHome ? setHomeReserves : setAwayReserves;
    
    // If already in playing, move to unselected
    if (playing.includes(player)) {
      setPlaying(playing.filter(p => p !== player));
      return;
    }

    // If already in reserves, move to unselected
    if (reserves.includes(player)) {
      setReserves(reserves.filter(p => p !== player));
      return;
    }

    // Logic to add: Fill playing (11) first, then reserves (2)
    if (playing.length < 11) {
      setPlaying([...playing, player]);
    } else if (reserves.length < 2) {
      setReserves([...reserves, player]);
    } else {
      alert("Selection Full! (11 Playing + 2 Reserves)");
    }
  };

  const handleConfirm = () => {
    if (homePlaying.length !== 11 || awayPlaying.length !== 11) {
      alert("You must select exactly 11 playing members for each team.");
      return;
    }
    // We strictly check playing 11, reserves are optional but prompt encouraged 2
    onConfirm(homePlaying, awayPlaying, homeReserves, awayReserves);
  };

  const currentTeam = activeTab === 'home' ? homeTeam : awayTeam;
  const currentPlaying = activeTab === 'home' ? homePlaying : awayPlaying;
  const currentReserves = activeTab === 'home' ? homeReserves : awayReserves;

  return (
    <div className="flex flex-col h-full bg-tiger-black text-white p-4">
      <div className="mb-4 text-center">
        <h2 className="text-xl font-bold text-tiger-gold uppercase tracking-wider">Select Squads</h2>
        <p className="text-gray-400 text-xs mt-1">Select 11 Playing & 2 Reserves</p>
      </div>

      <div className="flex mb-4 bg-gray-800 p-1 rounded-lg">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex-1 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'home' ? 'bg-tiger-gold text-black shadow' : 'text-gray-400'}`}
        >
          {homeTeam.name} 
          <span className="text-[10px] bg-black/20 px-2 rounded-full font-mono">{homePlaying.length + homeReserves.length}/13</span>
        </button>
        <button 
          onClick={() => setActiveTab('away')}
          className={`flex-1 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'away' ? 'bg-tiger-gold text-black shadow' : 'text-gray-400'}`}
        >
          {awayTeam.name} 
          <span className="text-[10px] bg-black/20 px-2 rounded-full font-mono">{awayPlaying.length + awayReserves.length}/13</span>
        </button>
      </div>

      {/* Stats Bar */}
      <div className="flex justify-between px-4 py-2 bg-gray-900 rounded-lg mb-2 text-xs font-bold uppercase tracking-wider">
         <div className="text-tiger-gold">Playing XI: {currentPlaying.length}/11</div>
         <div className="text-blue-400">Reserves: {currentReserves.length}/2</div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 bg-gray-900/50 p-2 rounded-xl border border-gray-800">
        {currentTeam.squad.map((player, idx) => {
          const isPlaying = currentPlaying.includes(player);
          const isReserve = currentReserves.includes(player);
          
          let statusColor = "bg-gray-800/50 border-gray-700 text-gray-500";
          let icon = <Circle size={20} />;
          
          if (isPlaying) {
             statusColor = "bg-tiger-gold/20 border-tiger-gold text-white";
             icon = <CheckCircle2 className="text-tiger-gold" size={20} />;
          } else if (isReserve) {
             statusColor = "bg-blue-900/30 border-blue-500 text-blue-200";
             icon = <UserPlus className="text-blue-400" size={20} />;
          }

          return (
            <button
              key={idx}
              onClick={() => toggleSelection(player, activeTab === 'home')}
              className={`w-full p-3 rounded-lg flex justify-between items-center transition-all border ${statusColor} hover:brightness-110`}
            >
              <span className="font-semibold">{player}</span>
              <div className="flex items-center gap-2">
                 {isPlaying && <span className="text-[10px] font-bold uppercase text-tiger-gold">Playing</span>}
                 {isReserve && <span className="text-[10px] font-bold uppercase text-blue-400">Reserve</span>}
                 {icon}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex gap-4">
        <button onClick={onBack} className="flex-1 py-4 bg-gray-800 text-white rounded-xl font-bold">Back</button>
        <button 
          onClick={handleConfirm}
          className="flex-[2] py-4 bg-gradient-to-r from-tiger-gold to-tiger-orange text-black rounded-xl font-bold shadow-lg disabled:opacity-50"
          disabled={homePlaying.length !== 11 || awayPlaying.length !== 11}
        >
          Confirm Squads
        </button>
      </div>
    </div>
  );
};