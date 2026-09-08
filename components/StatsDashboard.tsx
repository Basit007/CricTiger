import React, { useState, useMemo, useEffect } from 'react';
import { MatchState, Player } from '../types';
import { aggregateStats, CareerStats } from '../utils/statsLogic';
import { ArrowLeft, Trophy, Calendar, ChevronRight, X, FileText, Download, UserCheck, ArrowUpRight } from 'lucide-react';

interface Props {
  matchHistory: MatchState[];
  onBack: () => void;
  currentTeamName?: string;
}

export const StatsDashboard: React.FC<Props> = ({ matchHistory, onBack, currentTeamName = 'Club' }) => {
  const [activeTab, setActiveTab] = useState<'players' | 'matches'>('players');
  const [statType, setStatType] = useState<'batting' | 'bowling'>('batting');
  const [selectedMatch, setSelectedMatch] = useState<MatchState | null>(null);
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null);
  
  const HOME_TEAM_NAME = currentTeamName;

  // Clear highlight when tab changes manually
  useEffect(() => {
    if (activeTab === 'matches') setHighlightedPlayer(null);
  }, [activeTab]);

  // --- CAREER STATS LOGIC ---
  const playerStats = useMemo(() => aggregateStats(matchHistory, HOME_TEAM_NAME), [matchHistory]);

  const sortedCareerPlayers = useMemo(() => {
    return [...playerStats].sort((a, b) => {
      if (statType === 'batting') return b.runs - a.runs;
      return b.wickets - a.wickets;
    });
  }, [playerStats, statType]);

  // --- MATCH DETAIL LOGIC ---
  const getMatchPlayers = (match: MatchState) => {
    if (match.battingTeam.name === HOME_TEAM_NAME) return match.battingTeam.players;
    if (match.bowlingTeam.name === HOME_TEAM_NAME) return match.bowlingTeam.players;
    return []; 
  };

  const sortedMatchPlayers = useMemo(() => {
    if (!selectedMatch) return [];
    const players = getMatchPlayers(selectedMatch);
    return [...players].sort((a, b) => {
      if (statType === 'batting') return b.runs - a.runs;
      return b.wickets - a.wickets; 
    });
  }, [selectedMatch, statType]);

  const goToCareer = (playerName: string) => {
    setHighlightedPlayer(playerName);
    setActiveTab('players');
    setSelectedMatch(null);
    // Auto scroll to player if needed (simplified here)
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  // --- HELPERS ---
  const calcBatAvg = (runs: number, outs: number) => {
    if (outs === 0) return runs === 0 ? '-' : runs.toFixed(2);
    return (runs / outs).toFixed(2);
  };

  const calcBatSR = (runs: number, balls: number) => {
    if (balls === 0) return '-';
    return ((runs / balls) * 100).toFixed(2);
  };

  const calcBowlEcon = (runs: number, balls: number) => {
    if (balls === 0) return '-';
    return ((runs / balls) * 6).toFixed(2);
  };

  const calcBowlSR = (balls: number, wickets: number) => {
    if (wickets === 0) return '-';
    return (balls / wickets).toFixed(2);
  };

  const calcOvers = (balls: number) => `${Math.floor(balls/6)}.${balls%6}`;

  const getMatchResult = (match: MatchState) => {
    if (match.matchStatus !== 'COMPLETED') return { text: 'In Progress / Abandoned', color: 'text-gray-500' };
    if (!match.firstInningsScore) return { text: 'Result Unknown', color: 'text-gray-500' };

    const scoreFirst = match.firstInningsScore.runs;
    const scoreSecond = match.totalRuns;
    const teamBattingSecond = match.battingTeam.name;
    const teamBattingFirst = match.firstInningsScore.teamName;

    let winner = '';
    let margin = '';

    if (scoreSecond > scoreFirst) {
      winner = teamBattingSecond;
      margin = `${10 - match.wickets} wickets`;
    } else if (scoreFirst > scoreSecond) {
      winner = teamBattingFirst;
      margin = `${scoreFirst - scoreSecond} runs`;
    } else {
      return { text: 'Match Tied', color: 'text-gray-400' };
    }

    if (winner === HOME_TEAM_NAME) {
       return { text: `Won by ${margin}`, color: 'text-green-400' };
    } else {
       return { text: `Lost by ${margin}`, color: 'text-red-400' };
    }
  };

  // --- RENDERERS ---

  const renderBattingTable = (data: (CareerStats | Player)[], isCareer: boolean) => (
    <>
      <div className="grid grid-cols-8 bg-gray-750 p-3 border-b border-gray-700 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider text-center sticky top-0 print-table-header">
        <div className="col-span-2 text-left pl-2">Player</div>
        <div>{isCareer ? 'Mat' : ''}</div>
        <div>Runs</div>
        <div>Balls</div>
        <div>{isCareer ? 'HS' : 'SR'}</div>
        <div>{isCareer ? 'Avg' : ''}</div>
        <div className="no-print"></div>
      </div>
      <div className="divide-y divide-gray-700/50">
        {data.filter(p => (isCareer ? (p as CareerStats).matches > 0 : (p as Player).balls > 0 || (p as Player).isOut)).map((p, idx) => {
          const runs = p.runs;
          const balls = isCareer ? (p as CareerStats).ballsFaced : (p as Player).balls;
          const matches = isCareer ? (p as CareerStats).matches : 1;
          const hs = isCareer ? (p as CareerStats).highestScore : runs;
          const outs = isCareer ? (p as CareerStats).outs : ((p as Player).isOut ? 1 : 0);
          const sr = calcBatSR(runs, balls);
          const avg = calcBatAvg(runs, outs);
          const isHighlighted = highlightedPlayer === p.name;

          return (
            <div key={p.name} className={`grid grid-cols-8 p-3 items-center text-xs sm:text-sm text-center transition-colors ${isHighlighted ? 'bg-tiger-gold/20' : 'hover:bg-gray-700/30'}`}>
              <div className="col-span-2 text-left font-bold text-white pl-2 flex items-center gap-2 overflow-hidden">
                 <span className="truncate">{p.name}</span>
                 {isHighlighted && <UserCheck size={12} className="text-tiger-gold flex-shrink-0" />}
              </div>
              <div className="text-gray-500">{isCareer ? matches : ''}</div>
              <div className="font-bold text-tiger-gold">{runs}</div>
              <div className="text-gray-400">{balls}</div>
              <div className="text-gray-300 font-mono">{isCareer ? hs : sr}</div>
              <div className="text-gray-300 font-mono">{isCareer ? avg : ''}</div>
              <div className="no-print flex justify-center">
                 {!isCareer && (
                   <button onClick={() => goToCareer(p.name)} className="p-1 hover:text-tiger-gold text-gray-500" title="View Career Stats">
                     <ArrowUpRight size={16} />
                   </button>
                 )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderBowlingTable = (data: (CareerStats | Player)[], isCareer: boolean) => (
    <>
      <div className="grid grid-cols-9 bg-gray-750 p-3 border-b border-gray-700 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider text-center sticky top-0 print-table-header">
        <div className="col-span-2 text-left pl-2">Player</div>
        <div>{isCareer ? 'Mat' : ''}</div>
        <div>Overs</div>
        <div>Wkts</div>
        <div>Runs</div>
        <div>Econ</div>
        <div>SR</div>
        <div className="no-print"></div>
      </div>
      <div className="divide-y divide-gray-700/50">
        {data.filter(p => p.ballsBowled > 0).map((p, idx) => {
          const wickets = p.wickets;
          const runs = p.runsConceded;
          const balls = p.ballsBowled;
          const matches = isCareer ? (p as CareerStats).matches : 1;
          const econ = calcBowlEcon(runs, balls);
          const sr = calcBowlSR(balls, wickets);
          const overs = calcOvers(balls);
          const isHighlighted = highlightedPlayer === p.name;

          return (
            <div key={p.name} className={`grid grid-cols-9 p-3 items-center text-xs sm:text-sm text-center transition-colors ${isHighlighted ? 'bg-tiger-gold/20' : 'hover:bg-gray-700/30'}`}>
              <div className="col-span-2 text-left font-bold text-white pl-2 flex items-center gap-2 overflow-hidden">
                 <span className="truncate">{p.name}</span>
                 {isHighlighted && <UserCheck size={12} className="text-tiger-gold flex-shrink-0" />}
              </div>
              <div className="text-gray-500">{isCareer ? matches : ''}</div>
              <div className="text-gray-400">{overs}</div>
              <div className="font-bold text-blue-400">{wickets}</div>
              <div className="text-gray-400">{runs}</div>
              <div className="text-gray-300 font-mono">{econ}</div>
              <div className="text-gray-300 font-mono">{sr}</div>
              <div className="no-print flex justify-center">
                 {!isCareer && (
                   <button onClick={() => goToCareer(p.name)} className="p-1 hover:text-tiger-gold text-gray-500" title="View Career Stats">
                     <ArrowUpRight size={16} />
                   </button>
                 )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full bg-tiger-black text-white font-sans relative">
      
      {/* Header */}
      <div className="bg-tiger-card p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 z-10 no-print">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
            <ArrowLeft size={20} className="text-tiger-gold" />
          </button>
          <h2 className="text-xl font-bold text-white truncate">
            {selectedMatch ? 'Match Details' : `${HOME_TEAM_NAME} Stats Hub`}
          </h2>
        </div>
        
        <button onClick={handleDownloadPDF} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all border border-gray-700 text-gray-300">
           <Download size={14} /> PDF Report
        </button>
      </div>

      {selectedMatch ? (
        // --- MATCH DETAIL VIEW ---
        <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 print-container">
           {/* Match Info Header */}
           <div className="p-4 bg-gray-900 border-b border-gray-800">
              <div className="flex justify-between items-start mb-2">
                 <div>
                    <h3 className="font-bold text-white text-lg print:text-black">{selectedMatch.battingTeam.name} vs {selectedMatch.bowlingTeam.name}</h3>
                    <p className="text-xs text-gray-500">{new Date(selectedMatch.ballHistory[0]?.timestamp || Date.now()).toLocaleDateString()}</p>
                 </div>
                 <button onClick={() => setSelectedMatch(null)} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white no-print">
                    <X size={16} />
                 </button>
              </div>
              <div className="text-sm">
                 <span className={`${getMatchResult(selectedMatch).color} font-bold uppercase`}>{getMatchResult(selectedMatch).text}</span>
              </div>
           </div>

           {/* Stat Toggle */}
           <div className="p-4 bg-gray-900/50 no-print">
             <div className="flex bg-gray-800 p-1 rounded-xl border border-gray-700 w-full max-w-sm mx-auto">
                <button 
                  onClick={() => setStatType('batting')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${statType === 'batting' ? 'bg-tiger-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                  Batting
                </button>
                <button 
                  onClick={() => setStatType('bowling')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${statType === 'bowling' ? 'bg-tiger-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                  Bowling
                </button>
             </div>
           </div>
           
           {/* Table */}
           <div className="flex-1 overflow-y-auto p-4 pt-0">
              <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden print:border-black print:border-t">
                {statType === 'batting' 
                  ? renderBattingTable(sortedMatchPlayers, false) 
                  : renderBowlingTable(sortedMatchPlayers, false)
                }
              </div>
           </div>
        </div>
      ) : (
        // --- MAIN DASHBOARD VIEW ---
        <div className="flex-1 flex flex-col overflow-hidden print-container">
          {/* Tabs */}
          <div className="flex bg-gray-900 border-b border-gray-800 no-print">
            <button 
              onClick={() => setActiveTab('players')}
              className={`flex-1 py-4 font-bold text-xs sm:text-sm uppercase tracking-wider border-b-2 transition-all ${activeTab === 'players' ? 'border-tiger-gold text-tiger-gold bg-gray-800' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              Career Stats
            </button>
            <button 
              onClick={() => setActiveTab('matches')}
              className={`flex-1 py-4 font-bold text-xs sm:text-sm uppercase tracking-wider border-b-2 transition-all ${activeTab === 'matches' ? 'border-tiger-gold text-tiger-gold bg-gray-800' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              Match History
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-900/50">
            {activeTab === 'players' ? (
              <div className="p-4 space-y-4">
                {/* Stat Type Toggle */}
                <div className="flex bg-gray-800 p-1 rounded-xl border border-gray-700 w-full max-w-sm mx-auto no-print">
                  <button 
                    onClick={() => setStatType('batting')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${statType === 'batting' ? 'bg-tiger-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  >
                    Batting
                  </button>
                  <button 
                    onClick={() => setStatType('bowling')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${statType === 'bowling' ? 'bg-tiger-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  >
                    Bowling
                  </button>
                </div>

                <div className="print-only mb-6">
                   <h1 className="text-2xl font-black uppercase text-black">Career Stats Report</h1>
                   <p className="text-sm text-gray-600">Generated for {HOME_TEAM_NAME} on {new Date().toLocaleDateString()}</p>
                </div>

                {/* Stats Table */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden print:border-black">
                    {statType === 'batting' 
                      ? renderBattingTable(sortedCareerPlayers, true)
                      : renderBowlingTable(sortedCareerPlayers, true)
                    }
                </div>
                
                <div className="text-[10px] text-center text-gray-500 mt-4 italic no-print">
                    * Mat: Matches | HS: Highest Score | Avg: Average | Econ: Economy Rate
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4 no-print">
                {matchHistory.length === 0 ? (
                    <div className="text-center text-gray-500 py-10">No matches played yet.</div>
                ) : (
                  matchHistory.slice().reverse().map((match, idx) => {
                    const result = getMatchResult(match);
                    const date = new Date(match.ballHistory[0]?.timestamp || Date.now()).toLocaleDateString();

                    return (
                      <button 
                        key={idx} 
                        onClick={() => setSelectedMatch(match)}
                        className="w-full text-left bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-lg relative overflow-hidden group hover:border-tiger-gold transition-all hover:scale-[1.01]"
                      >
                        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full pointer-events-none" />
                        
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                            <Calendar size={10} /> {date}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${result.color} bg-black/20 border-current`}>
                            {result.text}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 mt-2">
                            {match.firstInningsScore && (
                              <div className="flex justify-between items-center text-xs text-gray-400">
                                  <span>{match.firstInningsScore.teamName}</span>
                                  <span className="font-mono">{match.firstInningsScore.runs}/{match.firstInningsScore.wickets} <span className="text-[10px]">({match.firstInningsScore.overs})</span></span>
                              </div>
                            )}
                            <div className="flex justify-between items-center text-xs text-white font-semibold">
                                <span>{match.battingTeam.name}</span>
                                <span className="font-mono">{match.totalRuns}/{match.wickets} <span className="text-[10px] text-gray-400">({match.currentOver}.{match.currentBall})</span></span>
                            </div>
                        </div>
                        
                        <div className="mt-3 flex items-center justify-end text-tiger-gold text-[10px] font-bold uppercase tracking-wider gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           View Stats <ChevronRight size={12} />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};