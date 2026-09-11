import React, { useState, useMemo, useEffect } from 'react';
import { MatchState, Player } from '../types';
import { 
  aggregateStats, 
  aggregateTeamStats, 
  generateCareerCSV, 
  generateCareerTSV, 
  generateMatchesCSV,
  CareerStats 
} from '../utils/statsLogic';
import { 
  ArrowLeft, 
  Trophy, 
  Calendar, 
  ChevronRight, 
  X, 
  FileText, 
  Download, 
  UserCheck, 
  ArrowUpRight, 
  Copy, 
  Check, 
  ExternalLink, 
  Shield, 
  Flame, 
  Award, 
  TrendingUp, 
  BarChart3,
  Table,
  Users,
  Search,
  Database
} from 'lucide-react';
import { getDeveloperDbConfig } from '../utils/storage';

interface Props {
  matchHistory: MatchState[];
  onBack: () => void;
  currentTeamName?: string;
  onOpenDevDb?: () => void;
}

export const StatsDashboard: React.FC<Props> = ({ 
  matchHistory, 
  onBack, 
  currentTeamName = 'Club',
  onOpenDevDb 
}) => {
  const [activeTab, setActiveTab] = useState<'players' | 'team' | 'matches'>('players');
  const [statType, setStatType] = useState<'batting' | 'bowling'>('batting');
  const [selectedMatch, setSelectedMatch] = useState<MatchState | null>(null);
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null);
  const [sheetsModalOpen, setSheetsModalOpen] = useState(false);
  const [copiedState, setCopiedState] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const dbConfig = useMemo(() => getDeveloperDbConfig(), []);
  const HOME_TEAM_NAME = currentTeamName;

  // Clear highlight when tab changes manually
  useEffect(() => {
    if (activeTab !== 'players') setHighlightedPlayer(null);
  }, [activeTab]);

  // Aggregate Career Stats
  const playerStats = useMemo(() => aggregateStats(matchHistory, HOME_TEAM_NAME), [matchHistory, HOME_TEAM_NAME]);

  // Team Aggregate Summary
  const teamStats = useMemo(() => aggregateTeamStats(matchHistory, HOME_TEAM_NAME), [matchHistory, HOME_TEAM_NAME]);

  const sortedCareerPlayers = useMemo(() => {
    let list = [...playerStats];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      if (statType === 'batting') return b.runs - a.runs;
      return b.wickets - a.wickets;
    });
  }, [playerStats, statType, searchQuery]);

  // Match detail players
  const getMatchPlayers = (match: MatchState) => {
    if (match.battingTeam.name === HOME_TEAM_NAME) return match.battingTeam.players;
    if (match.bowlingTeam.name === HOME_TEAM_NAME) return match.bowlingTeam.players;
    return [...match.battingTeam.players, ...match.bowlingTeam.players];
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
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleCopyTSV = (data: string, label: string) => {
    navigator.clipboard.writeText(data).then(() => {
      setCopiedState(label);
      setTimeout(() => setCopiedState(null), 2500);
    });
  };

  const handleDownloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Calculations
  const calcBatAvg = (runs: number, outs: number) => {
    if (outs === 0) return runs === 0 ? '-' : runs.toFixed(2);
    return (runs / outs).toFixed(2);
  };

  const calcBatSR = (runs: number, balls: number) => {
    if (balls === 0) return '-';
    return ((runs / balls) * 100).toFixed(1);
  };

  const calcBowlEcon = (runs: number, balls: number) => {
    if (balls === 0) return '-';
    return ((runs / balls) * 6).toFixed(2);
  };

  const calcBowlSR = (balls: number, wickets: number) => {
    if (wickets === 0) return '-';
    return (balls / wickets).toFixed(1);
  };

  const calcOvers = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

  const getMatchResult = (match: MatchState) => {
    if (match.customResult) {
      return { text: match.customResult, color: 'text-amber-400' };
    }
    if (match.declarationNote) {
      return { text: match.declarationNote, color: 'text-yellow-400' };
    }
    if (match.matchStatus !== 'COMPLETED') {
      return { text: 'In Progress / Abandoned', color: 'text-gray-500' };
    }
    if (!match.firstInningsScore) {
      return { text: 'Result Unknown', color: 'text-gray-500' };
    }

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

  // Batting Table
  const renderBattingTable = (data: (CareerStats | Player)[], isCareer: boolean) => (
    <>
      <div className="grid grid-cols-12 bg-gray-750 p-2.5 sm:p-3 border-b border-gray-700 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider text-center sticky top-0 print-table-header">
        <div className="col-span-3 text-left pl-2">Player</div>
        <div className="col-span-1">{isCareer ? 'Mat' : ''}</div>
        <div className="col-span-1">Runs</div>
        <div className="col-span-1">Balls</div>
        <div className="col-span-1">4s</div>
        <div className="col-span-1">6s</div>
        <div className="col-span-1 font-mono">{isCareer ? 'HS' : 'SR'}</div>
        <div className="col-span-1">{isCareer ? 'SR' : ''}</div>
        <div className="col-span-2">{isCareer ? 'Avg' : ''}</div>
        <div className="col-span-1 no-print"></div>
      </div>
      <div className="divide-y divide-gray-700/50">
        {data.filter(p => (isCareer ? (p as CareerStats).matches > 0 : (p as Player).balls > 0 || (p as Player).isOut)).map((p) => {
          const runs = p.runs;
          const balls = isCareer ? (p as CareerStats).ballsFaced : (p as Player).balls;
          const fours = p.fours || 0;
          const sixes = p.sixes || 0;
          const matches = isCareer ? (p as CareerStats).matches : 1;
          const hs = isCareer ? (p as CareerStats).highestScore : runs;
          const outs = isCareer ? (p as CareerStats).outs : ((p as Player).isOut ? 1 : 0);
          const sr = calcBatSR(runs, balls);
          const avg = calcBatAvg(runs, outs);
          const isHighlighted = highlightedPlayer === p.name;

          return (
            <div 
              key={p.name} 
              className={`grid grid-cols-12 p-2.5 sm:p-3 items-center text-xs sm:text-sm text-center transition-colors ${
                isHighlighted ? 'bg-tiger-gold/20' : 'hover:bg-gray-750/50'
              }`}
            >
              <div className="col-span-3 text-left font-bold text-white pl-2 flex items-center gap-1.5 overflow-hidden">
                 <span className="truncate">{p.name}</span>
                 {isHighlighted && <UserCheck size={12} className="text-tiger-gold flex-shrink-0" />}
              </div>
              <div className="col-span-1 text-gray-400 font-mono">{isCareer ? matches : ''}</div>
              <div className="col-span-1 font-black text-tiger-gold">{runs}</div>
              <div className="col-span-1 text-gray-400 font-mono">{balls}</div>
              <div className="col-span-1 text-green-400 font-mono">{fours}</div>
              <div className="col-span-1 text-amber-400 font-mono">{sixes}</div>
              <div className="col-span-1 text-gray-300 font-mono">{isCareer ? hs : sr}</div>
              <div className="col-span-1 text-gray-300 font-mono">{isCareer ? sr : ''}</div>
              <div className="col-span-2 text-gray-300 font-mono">{isCareer ? avg : ''}</div>
              <div className="col-span-1 no-print flex justify-center">
                 {!isCareer && (
                   <button 
                     onClick={() => goToCareer(p.name)} 
                     className="p-1 hover:text-tiger-gold text-gray-500" 
                     title="View Career Stats"
                   >
                     <ArrowUpRight size={14} />
                   </button>
                 )}
              </div>
            </div>
          );
        })}
        {data.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-xs italic">
            No batting records recorded yet.
          </div>
        )}
      </div>
    </>
  );

  // Bowling Table
  const renderBowlingTable = (data: (CareerStats | Player)[], isCareer: boolean) => (
    <>
      <div className="grid grid-cols-12 bg-gray-750 p-2.5 sm:p-3 border-b border-gray-700 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider text-center sticky top-0 print-table-header">
        <div className="col-span-3 text-left pl-2">Player</div>
        <div className="col-span-1">{isCareer ? 'Mat' : ''}</div>
        <div className="col-span-2">Overs</div>
        <div className="col-span-1">Wkts</div>
        <div className="col-span-1">Runs</div>
        <div className="col-span-1">Econ</div>
        <div className="col-span-1">SR</div>
        <div className="col-span-2">{isCareer ? 'BBI' : ''}</div>
      </div>
      <div className="divide-y divide-gray-700/50">
        {data.filter(p => p.ballsBowled > 0).map((p) => {
          const wickets = p.wickets;
          const runs = p.runsConceded;
          const balls = p.ballsBowled;
          const matches = isCareer ? (p as CareerStats).matches : 1;
          const econ = calcBowlEcon(runs, balls);
          const sr = calcBowlSR(balls, wickets);
          const bbi = isCareer && (p as CareerStats).bestBowling.wickets > 0 
            ? `${(p as CareerStats).bestBowling.wickets}/${(p as CareerStats).bestBowling.runs}`
            : '-';
          const isHighlighted = highlightedPlayer === p.name;

          return (
            <div 
              key={p.name} 
              className={`grid grid-cols-12 p-2.5 sm:p-3 items-center text-xs sm:text-sm text-center transition-colors ${
                isHighlighted ? 'bg-tiger-gold/20' : 'hover:bg-gray-750/50'
              }`}
            >
              <div className="col-span-3 text-left font-bold text-white pl-2 flex items-center gap-1.5 overflow-hidden">
                 <span className="truncate">{p.name}</span>
                 {isHighlighted && <UserCheck size={12} className="text-tiger-gold flex-shrink-0" />}
              </div>
              <div className="col-span-1 text-gray-400 font-mono">{isCareer ? matches : ''}</div>
              <div className="col-span-2 text-gray-300 font-mono">{calcOvers(balls)}</div>
              <div className="col-span-1 font-black text-blue-400 font-mono">{wickets}</div>
              <div className="col-span-1 text-gray-300 font-mono">{runs}</div>
              <div className="col-span-1 text-gray-300 font-mono">{econ}</div>
              <div className="col-span-1 text-gray-300 font-mono">{sr}</div>
              <div className="col-span-2 text-tiger-gold font-mono">{isCareer ? bbi : ''}</div>
            </div>
          );
        })}
        {data.filter(p => p.ballsBowled > 0).length === 0 && (
          <div className="p-8 text-center text-gray-500 text-xs italic">
            No bowling records recorded yet.
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="h-full w-full bg-tiger-black text-white flex flex-col overflow-hidden relative">
      
      {/* TOP HEADER */}
      <div className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center no-print">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
              <BarChart3 size={18} className="text-tiger-gold" />
              <span>Statistics & Records</span>
            </h1>
            <p className="text-[11px] text-gray-400">{HOME_TEAM_NAME} Club Archives</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Cloud Database Status / Dev Trigger */}
          {onOpenDevDb && (
            <button
              onClick={onOpenDevDb}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors border ${
                dbConfig.sheetWebhookUrl 
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25' 
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
              }`}
              title="Developer Database Settings (Google Sheets)"
            >
              {dbConfig.sheetWebhookUrl ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="hidden sm:inline">Google Sheets DB</span>
                  <span className="sm:hidden">DB</span>
                </>
              ) : (
                <>
                  <Database size={12} className="text-tiger-gold" />
                  <span className="hidden sm:inline">Dev DB</span>
                </>
              )}
            </button>
          )}

          {/* Google Sheets Sync / Export Button */}
          <button
            onClick={() => setSheetsModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-green-600/20 text-green-300 border border-green-500/40 text-xs font-bold uppercase tracking-wider hover:bg-green-600/30 transition-colors flex items-center gap-1.5 shadow-sm"
            title="Export to Google Sheets or Excel"
          >
            <Table size={14} className="text-green-400" />
            <span>Sheets</span>
          </button>

          <button 
            onClick={handleDownloadPDF} 
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors" 
            title="Print Report"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* SELECTED MATCH VIEW */}
      {selectedMatch ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-900/50">
           <div className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
             <div>
               <div className="text-[10px] text-gray-400 uppercase font-bold">Match Breakdown</div>
               <h2 className="text-sm sm:text-base font-black text-white">
                 {selectedMatch.firstInningsScore?.teamName || selectedMatch.bowlingTeam.name} vs {selectedMatch.battingTeam.name}
               </h2>
               <div className="text-xs text-tiger-gold mt-0.5">{getMatchResult(selectedMatch).text}</div>
             </div>
             <button 
               onClick={() => setSelectedMatch(null)}
               className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-750 text-gray-400 hover:text-white"
             >
               <X size={16} />
             </button>
           </div>

           {/* Stat Toggle */}
           <div className="p-4 bg-gray-900/50 no-print">
             <div className="flex bg-gray-800 p-1 rounded-xl border border-gray-700 w-full max-w-sm mx-auto">
                <button 
                  onClick={() => setStatType('batting')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                    statType === 'batting' ? 'bg-tiger-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Batting
                </button>
                <button 
                  onClick={() => setStatType('bowling')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                    statType === 'bowling' ? 'bg-tiger-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'
                  }`}
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
        // MAIN TABS DASHBOARD
        <div className="flex-1 flex flex-col overflow-hidden print-container">
          {/* Main Navigation Tabs */}
          <div className="flex bg-gray-900 border-b border-gray-800 no-print">
            <button 
              onClick={() => setActiveTab('players')}
              className={`flex-1 py-3.5 font-black text-xs sm:text-sm uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'players' ? 'border-tiger-gold text-tiger-gold bg-gray-800/80' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Users size={14} /> Player Stats
            </button>
            <button 
              onClick={() => setActiveTab('team')}
              className={`flex-1 py-3.5 font-black text-xs sm:text-sm uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'team' ? 'border-tiger-gold text-tiger-gold bg-gray-800/80' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Shield size={14} /> Team Records
            </button>
            <button 
              onClick={() => setActiveTab('matches')}
              className={`flex-1 py-3.5 font-black text-xs sm:text-sm uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'matches' ? 'border-tiger-gold text-tiger-gold bg-gray-800/80' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Calendar size={14} /> Match History ({matchHistory.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-900/40 p-4">
            {/* 1. PLAYER STATS TAB */}
            {activeTab === 'players' && (
              <div className="space-y-4 max-w-5xl mx-auto">
                {/* Stat Type Toggle */}
                <div className="flex bg-gray-800 p-1 rounded-xl border border-gray-700 w-full max-w-sm mx-auto no-print">
                  <button 
                    onClick={() => setStatType('batting')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                      statType === 'batting' ? 'bg-tiger-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Batting Career
                  </button>
                  <button 
                    onClick={() => setStatType('bowling')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                      statType === 'bowling' ? 'bg-tiger-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Bowling Career
                  </button>
                </div>

                {/* Player Search Input */}
                <div className="flex items-center gap-2 max-w-sm mx-auto bg-gray-800 border border-gray-700 px-3 py-2 rounded-xl no-print shadow-sm">
                  <Search size={14} className="text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search player by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-white text-xs outline-none w-full placeholder:text-gray-500 font-medium"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-white text-[10px]">
                      <X size={13} />
                    </button>
                  )}
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
                    * Mat: Matches | 4s: Fours | 6s: Sixes | HS: Highest Score | SR: Strike Rate | Avg: Average | Econ: Economy | BBI: Best Bowling
                </div>
              </div>
            )}

            {/* 2. TEAM STATS TAB */}
            {activeTab === 'team' && (
              <div className="space-y-4 max-w-4xl mx-auto">
                {/* Win / Loss Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-gray-800/80 rounded-xl border border-gray-700/80 text-center">
                    <div className="text-[10px] text-gray-400 uppercase font-bold">Matches Played</div>
                    <div className="text-2xl font-black text-white mt-0.5">{teamStats.totalMatches}</div>
                  </div>
                  <div className="p-3.5 bg-green-500/10 rounded-xl border border-green-500/30 text-center">
                    <div className="text-[10px] text-green-400 uppercase font-bold">Wins</div>
                    <div className="text-2xl font-black text-green-400 mt-0.5">{teamStats.won}</div>
                  </div>
                  <div className="p-3.5 bg-red-500/10 rounded-xl border border-red-500/30 text-center">
                    <div className="text-[10px] text-red-400 uppercase font-bold">Defeats</div>
                    <div className="text-2xl font-black text-red-400 mt-0.5">{teamStats.lost}</div>
                  </div>
                  <div className="p-3.5 bg-tiger-gold/10 rounded-xl border border-tiger-gold/30 text-center">
                    <div className="text-[10px] text-tiger-gold uppercase font-bold">Win Rate</div>
                    <div className="text-2xl font-black text-tiger-gold mt-0.5">{teamStats.winRate}%</div>
                  </div>
                </div>

                {/* Team Records Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Highest & Lowest Totals */}
                  <div className="p-4 bg-gray-800 rounded-xl border border-gray-700 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-300">
                      <Flame size={15} className="text-amber-400" />
                      <span>Team Totals</span>
                    </div>

                    <div className="p-3 bg-black/40 rounded-lg border border-gray-800 flex justify-between items-center">
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Highest Score</div>
                        <div className="text-base font-black text-white">
                          {teamStats.highestTotal.runs > 0 
                            ? `${teamStats.highestTotal.runs}/${teamStats.highestTotal.wickets} (${teamStats.highestTotal.overs} ov)` 
                            : '-'}
                        </div>
                        {teamStats.highestTotal.against && (
                          <div className="text-[10px] text-gray-400">vs {teamStats.highestTotal.against}</div>
                        )}
                      </div>
                      <Award size={20} className="text-tiger-gold" />
                    </div>

                    <div className="p-3 bg-black/40 rounded-lg border border-gray-800 flex justify-between items-center">
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Lowest Score</div>
                        <div className="text-base font-black text-gray-300">
                          {teamStats.lowestTotal.runs < 9999 
                            ? `${teamStats.lowestTotal.runs}/${teamStats.lowestTotal.wickets} (${teamStats.lowestTotal.overs} ov)` 
                            : '-'}
                        </div>
                        {teamStats.lowestTotal.against && (
                          <div className="text-[10px] text-gray-400">vs {teamStats.lowestTotal.against}</div>
                        )}
                      </div>
                      <Shield size={20} className="text-gray-500" />
                    </div>
                  </div>

                  {/* Top Performers */}
                  <div className="p-4 bg-gray-800 rounded-xl border border-gray-700 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-300">
                      <Trophy size={15} className="text-tiger-gold" />
                      <span>All-Time Leaders</span>
                    </div>

                    <div className="p-3 bg-black/40 rounded-lg border border-gray-800 flex justify-between items-center">
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Leading Run Scorer</div>
                        <div className="text-base font-black text-tiger-gold">
                          {teamStats.topRunScorer.name}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {teamStats.topRunScorer.runs} runs in {teamStats.topRunScorer.matches} matches
                        </div>
                      </div>
                      <TrendingUp size={20} className="text-tiger-gold" />
                    </div>

                    <div className="p-3 bg-black/40 rounded-lg border border-gray-800 flex justify-between items-center">
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Leading Wicket Taker</div>
                        <div className="text-base font-black text-blue-400">
                          {teamStats.topWicketTaker.name}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {teamStats.topWicketTaker.wickets} wickets in {teamStats.topWicketTaker.matches} matches
                        </div>
                      </div>
                      <Award size={20} className="text-blue-400" />
                    </div>
                  </div>
                </div>

                {/* Quick Google Sheets Export CTA */}
                <div className="p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/20 border border-green-600/30 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-green-300 flex items-center gap-1.5">
                      <Table size={14} />
                      <span>Need full team & player records in Google Sheets?</span>
                    </div>
                    <p className="text-[11px] text-gray-300">
                      Copy TSV data directly into any Google Sheet or download formatted CSV files.
                    </p>
                  </div>
                  <button
                    onClick={() => setSheetsModalOpen(true)}
                    className="px-3.5 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black text-xs font-black uppercase tracking-wider shadow-lg flex-shrink-0"
                  >
                    Open Sheets Export
                  </button>
                </div>
              </div>
            )}

            {/* 3. MATCH HISTORY TAB */}
            {activeTab === 'matches' && (
              <div className="space-y-3 max-w-3xl mx-auto no-print">
                {matchHistory.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                    <p>No matches recorded in history yet.</p>
                  </div>
                ) : (
                  matchHistory.slice().reverse().map((match, idx) => {
                    const result = getMatchResult(match);
                    const date = new Date(match.ballHistory[0]?.timestamp || Date.now()).toLocaleDateString();

                    return (
                      <button 
                        key={idx} 
                        onClick={() => setSelectedMatch(match)}
                        className="w-full text-left bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-lg relative overflow-hidden group hover:border-tiger-gold transition-all hover:scale-[1.005]"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                            <Calendar size={11} /> {date}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${result.color} bg-black/20 border-current`}>
                            {result.text}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5 mt-2">
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
                           View Full Scorecard & Stats <ChevronRight size={12} />
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

      {/* GOOGLE SHEETS & CSV EXPORT MODAL */}
      {sheetsModalOpen && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-4 bg-gray-950 border-b border-gray-800 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-green-500/10 rounded-lg text-green-400">
                  <Table size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wide">
                    Google Sheets & Records Export
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Save players, matches, runs, 4s, 6s, and wickets into spreadsheets
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSheetsModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* How it works banner */}
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl space-y-1">
                <div className="font-bold text-green-300 flex items-center gap-1.5">
                  <span>💡 How to sync with Google Sheets:</span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  Click <strong>"Copy for Google Sheets"</strong> below, open any Google Sheet (or type <code>sheets.new</code> in your browser), and press <strong>Paste (Ctrl+V / Cmd+V)</strong>. All columns (Player, Matches, Runs, 4s, 6s, Wickets, Averages) will automatically align!
                </p>
              </div>

              {/* Action 1: Instant Copy TSV */}
              <div className="p-3.5 bg-gray-800 rounded-xl border border-gray-700 space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white text-xs">Career Player Stats (TSV)</div>
                    <div className="text-[10px] text-gray-400">Formatted for 1-click paste into Google Sheets</div>
                  </div>
                  <button
                    onClick={() => handleCopyTSV(generateCareerTSV(playerStats, HOME_TEAM_NAME), 'player_tsv')}
                    className="px-3 py-1.5 rounded-lg bg-tiger-gold text-black font-black text-xs uppercase tracking-wider hover:bg-yellow-400 flex items-center gap-1.5 shadow"
                  >
                    {copiedState === 'player_tsv' ? (
                      <>
                        <Check size={14} /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copy for Sheets
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action 2: Download CSVs */}
              <div className="p-3.5 bg-gray-800 rounded-xl border border-gray-700 space-y-3">
                <div className="font-bold text-white text-xs">Download CSV Files (Importable to Sheets & Excel)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => handleDownloadCSV(
                      generateCareerCSV(playerStats, HOME_TEAM_NAME), 
                      `${HOME_TEAM_NAME.replace(/\s+/g, '_')}_career_stats.csv`
                    )}
                    className="p-2.5 rounded-lg bg-gray-700 hover:bg-gray-650 text-white font-bold text-xs flex items-center justify-between border border-gray-600 transition-colors"
                  >
                    <span>Player Stats (.csv)</span>
                    <Download size={14} className="text-tiger-gold" />
                  </button>
                  <button
                    onClick={() => handleDownloadCSV(
                      generateMatchesCSV(matchHistory, HOME_TEAM_NAME), 
                      `${HOME_TEAM_NAME.replace(/\s+/g, '_')}_match_history.csv`
                    )}
                    className="p-2.5 rounded-lg bg-gray-700 hover:bg-gray-650 text-white font-bold text-xs flex items-center justify-between border border-gray-600 transition-colors"
                  >
                    <span>Match Records (.csv)</span>
                    <Download size={14} className="text-tiger-gold" />
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-3 bg-black/40 border border-gray-800 rounded-xl space-y-1.5 text-[11px] text-gray-400">
                <div className="font-bold text-gray-300">Google Sheets Import Steps:</div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open Google Drive and create a new Google Spreadsheet.</li>
                  <li>Go to <strong>File &gt; Import &gt; Upload</strong> and choose the downloaded CSV.</li>
                  <li>Or simply copy the TSV above and press <strong>Paste (Ctrl+V)</strong>.</li>
                  <li>All player records and previous matches will be permanently preserved!</li>
                </ol>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-gray-950 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setSheetsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs uppercase"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
