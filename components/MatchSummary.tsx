import React, { useEffect, useState, useMemo } from 'react';
import { MatchState, Player } from '../types';
import { generateMatchSummary } from '../services/geminiService';
import { Share2, Save, Trophy, Medal, Crown, Home, TrendingUp, ListChecks, PieChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts';
import { ScorecardModal } from './ScorecardModal';

interface Props {
  matchState: MatchState;
  onSaveAndExit: (match: MatchState) => void;
}

export const MatchSummary: React.FC<Props> = ({ matchState, onSaveAndExit }) => {
  const [report, setReport] = useState("Generating AI Match Report...");
  const [activeTab, setActiveTab] = useState<'analysis' | 'inn1' | 'inn2'>('analysis');
  const [fullscreenScorecard, setFullscreenScorecard] = useState<1 | 2 | null>(null);

  useEffect(() => {
    generateMatchSummary(matchState).then(setReport);
  }, []);

  // --- RESULT LOGIC ---
  const result = useMemo(() => {
    const { inningsNumber, totalRuns, wickets, target, firstInningsScore, battingTeam, bowlingTeam, customResult, declarationNote } = matchState;

    if (customResult) {
      return {
        winner: customResult,
        margin: '',
        winnerTeam: customResult,
        isTie: false,
        color: 'text-amber-400'
      };
    }

    if (inningsNumber === 1 && !declarationNote) {
       return {
         winner: 'Innings Break',
         margin: 'First Innings Completed',
         winnerTeam: battingTeam.name,
         isTie: false,
         color: 'text-gray-400'
       };
    }

    const teamBattingSecond = battingTeam.name;
    const teamBattingFirst = firstInningsScore?.teamName || bowlingTeam.name;
    const targetScore = target || 0;
    
    // Logic: 
    // Batting Team (Chaser) Wins if totalRuns >= target
    // Bowling Team (Defender) Wins if totalRuns < target - 1
    // Tie if totalRuns === target - 1

    if (totalRuns >= targetScore) {
       const wicketsLeft = 10 - wickets;
       return {
         winner: teamBattingSecond,
         margin: `won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`,
         winnerTeam: teamBattingSecond,
         isTie: false,
         color: 'text-tiger-gold'
       };
    } else if (totalRuns < targetScore - 1) {
       const runDiff = (targetScore - 1) - totalRuns;
       return {
         winner: teamBattingFirst,
         margin: `won by ${runDiff} run${runDiff !== 1 ? 's' : ''}`,
         winnerTeam: teamBattingFirst,
         isTie: false,
         color: 'text-tiger-gold'
       };
    } else {
       return {
         winner: 'Match Tied',
         margin: 'Scores Level',
         winnerTeam: 'Draw',
         isTie: true,
         color: 'text-gray-200'
       };
    }
  }, [matchState]);

  // --- MVP LOGIC ---
  const mvp = useMemo(() => {
    // Combine players from both teams. 
    // Note: In 2nd innings, battingTeam is Team B, bowlingTeam is Team A. Both have full match stats.
    const allPlayers = [
        ...matchState.battingTeam.players.map(p => ({...p, teamName: matchState.battingTeam.name})), 
        ...matchState.bowlingTeam.players.map(p => ({...p, teamName: matchState.bowlingTeam.name}))
    ];

    // Score = Runs + (Wickets * 20)
    const scored = allPlayers.map(p => ({
        ...p,
        points: (p.runs * 1) + (p.wickets * 20) + (p.isOut ? 0 : 5) + (p.runs >= 50 ? 10 : 0) + (p.wickets >= 3 ? 10 : 0)
    }));

    // Sort desc
    return scored.sort((a, b) => b.points - a.points)[0];
  }, [matchState]);

  // --- DATA PREP ---
  const team1 = matchState.bowlingTeam; // Batted 1st
  const team2 = matchState.battingTeam; // Batted 2nd

  // If innings 1, setup is simpler
  const isInnings1 = matchState.inningsNumber === 1;

  // --- WORM CHART DATA ---
  const wormData = useMemo(() => {
    // We need to reconstruct the cumulative score per over for both innings.
    // This is tricky because we only have current matchState history (usually just the active innings or combined).
    // The current 'ballHistory' contains events. We need to filter by inningsNumber.
    
    // Note: App.tsx resets ballHistory for 2nd innings? 
    // Actually, looking at App.tsx, `handleStartSecondInnings` sets `totalRuns: 0` but doesn't explicitly clear ballHistory?
    // Wait, `newState` spreads `matchState` but if ballHistory isn't reset, it keeps old balls.
    // Assuming `ballHistory` contains ALL balls with `inningsNumber`.

    const getDataForInnings = (inningsNum: number) => {
        const events = matchState.ballHistory.filter(b => b.inningsNumber === inningsNum);
        if (events.length === 0 && inningsNum === 1 && matchState.firstInningsScore) {
           // If history was cleared (likely in App.tsx implementation logic which might have cleared it in a real app, 
           // but here `handleStartSecondInnings` in App.tsx creates a NEW object but doesn't explicitly empty ballHistory array in the snippet I saw?
           // Wait, App.tsx: `ballHistory: [],` IS NOT in the `handleStartSecondInnings` spread override.
           // However, if we assume `matchState` only holds CURRENT innings history in a typical react state update unless persisted...
           // Let's assume ballHistory has everything if we didn't clear it.
           // If it's missing, we can't plot innings 1.
           return [];
        }

        let cumulativeRun = 0;
        let currentOver = 0;
        const dataPoints: {over: number, runs: number}[] = [{over: 0, runs: 0}];

        events.forEach(ball => {
            cumulativeRun += ball.runs + ball.extraRuns;
            // Check if over changed. A ball doesn't explicitly store "over number" but we can derive or simplify.
            // Simplified: Push data point every 6 legal balls or just aggregate.
            // Better: Iterate and just push a point at the end of the array.
            // Let's just create a point for every event for smoothness? No, charts get busy.
            // Let's group by over.
        });

        // Re-loop to group by overs properly
        cumulativeRun = 0;
        let legalBalls = 0;
        
        events.forEach(ball => {
           cumulativeRun += ball.runs + ball.extraRuns;
           if (ball.isLegalBall) {
             legalBalls++;
             if (legalBalls % 6 === 0) {
                dataPoints.push({ over: legalBalls / 6, runs: cumulativeRun });
             }
           }
        });
        // Add final state
        if (legalBalls % 6 !== 0) {
           dataPoints.push({ over: parseFloat((legalBalls/6).toFixed(1)), runs: cumulativeRun });
        }
        return dataPoints;
    };

    const inn1Data = getDataForInnings(1);
    const inn2Data = getDataForInnings(2);

    // Merge for Recharts
    // Find max overs
    const maxOvers = Math.max(
        inn1Data.length > 0 ? inn1Data[inn1Data.length-1].over : 0,
        inn2Data.length > 0 ? inn2Data[inn2Data.length-1].over : 0
    );

    const merged = [];
    // We need integer overs 1..N roughly
    for (let i = 0; i <= Math.ceil(maxOvers); i++) {
        const d1 = inn1Data.find(d => Math.floor(d.over) === i || (i > 0 && Math.floor(d.over) === i-1 && d.over > i-1)); // Rough matching
        // Actually, let's just use the index if array is sequential overs.
        const point1 = inn1Data.find(p => p.over === i);
        const point2 = inn2Data.find(p => p.over === i);
        
        if (point1 || point2 || i === 0) {
             merged.push({
               name: i.toString(),
               [matchState.firstInningsScore?.teamName || 'Team 1']: point1?.runs,
               [matchState.battingTeam.name]: point2?.runs
             });
        }
    }
    return merged;

  }, [matchState]);


  return (
    <div className="flex flex-col h-full bg-tiger-black font-sans text-white overflow-y-auto">
      
      {/* --- HERO SECTION --- */}
      <div className="relative overflow-hidden bg-gradient-to-b from-gray-800 to-gray-900 border-b border-gray-800 p-8 text-center">
         {/* Background Decoration */}
         <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(251,191,36,0.2)_0%,transparent_70%)] animate-pulse" />
         </div>

         <div className="relative z-10">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Match Result</h2>
            
            {result.isTie ? (
               <div className="text-5xl font-black text-white uppercase tracking-tighter mb-2">MATCH TIED</div>
            ) : (
               <div className="flex flex-col items-center gap-2">
                 <Trophy size={48} className="text-tiger-gold mb-2 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]" />
                 <h1 className="text-4xl sm:text-5xl font-black text-white uppercase italic tracking-tight leading-none">
                    {result.winner}
                 </h1>
                 <div className={`text-xl font-bold ${result.color} uppercase tracking-widest bg-black/30 px-4 py-1 rounded-full mt-2 border border-white/10`}>
                    {result.margin}
                 </div>
               </div>
            )}
         </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-900 border-b border-gray-800 sticky top-0 z-20">
         <button 
           onClick={() => setActiveTab('analysis')}
           className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'analysis' ? 'text-tiger-gold border-b-2 border-tiger-gold bg-tiger-gold/5' : 'text-gray-500'}`}
         >
           <PieChart size={14} /> Analysis
         </button>
         <button 
           onClick={() => setActiveTab('inn1')}
           className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'inn1' ? 'text-tiger-gold border-b-2 border-tiger-gold bg-tiger-gold/5' : 'text-gray-500'}`}
         >
           <ListChecks size={14} /> 1st Inn
         </button>
         {!isInnings1 && (
           <button 
             onClick={() => setActiveTab('inn2')}
             className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'inn2' ? 'text-tiger-gold border-b-2 border-tiger-gold bg-tiger-gold/5' : 'text-gray-500'}`}
           >
             <ListChecks size={14} /> 2nd Inn
           </button>
         )}
      </div>

      <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto w-full">
        
        {activeTab === 'analysis' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* --- SCORE SUMMARY CARDS --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {/* Team 1 (Batted First) */}
               <div className={`p-4 rounded-xl border ${result.winnerTeam === team1.name ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-tiger-gold shadow-[0_0_15px_rgba(251,191,36,0.1)]' : 'bg-gray-800 border-gray-700 opacity-80'}`}>
                  <div className="flex justify-between items-start mb-2">
                     <span className="font-bold text-lg text-gray-200">{matchState.firstInningsScore?.teamName || team1.name}</span>
                     {result.winnerTeam === team1.name && <Crown size={16} className="text-tiger-gold" />}
                  </div>
                  <div className="flex items-baseline gap-2">
                     <span className="text-3xl font-black text-white">
                       {matchState.firstInningsScore ? matchState.firstInningsScore.runs : matchState.totalRuns}
                       <span className="text-xl text-gray-400">/{matchState.firstInningsScore ? matchState.firstInningsScore.wickets : matchState.wickets}</span>
                     </span>
                     <span className="text-xs text-gray-500 font-mono">
                       ({matchState.firstInningsScore ? matchState.firstInningsScore.overs : `${matchState.currentOver}.${matchState.currentBall}`})
                     </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2 uppercase tracking-wide font-bold">1st Innings</div>
               </div>

               {/* Team 2 (Batted Second) */}
               {!isInnings1 && (
                 <div className={`p-4 rounded-xl border ${result.winnerTeam === team2.name ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-tiger-gold shadow-[0_0_15px_rgba(251,191,36,0.1)]' : 'bg-gray-800 border-gray-700 opacity-80'}`}>
                    <div className="flex justify-between items-start mb-2">
                       <span className="font-bold text-lg text-gray-200">{team2.name}</span>
                       {result.winnerTeam === team2.name && <Crown size={16} className="text-tiger-gold" />}
                    </div>
                    <div className="flex items-baseline gap-2">
                       <span className="text-3xl font-black text-white">
                         {matchState.totalRuns}
                         <span className="text-xl text-gray-400">/{matchState.wickets}</span>
                       </span>
                       <span className="text-xs text-gray-500 font-mono">
                         ({matchState.currentOver}.{matchState.currentBall})
                       </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2 uppercase tracking-wide font-bold">2nd Innings</div>
                 </div>
               )}
            </div>

            {/* --- MAN OF THE MATCH --- */}
            {mvp && (
              <div className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 rounded-xl p-1 border border-tiger-gold/30 shadow-lg relative overflow-hidden group">
                 <div className="absolute inset-0 bg-tiger-gold/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                 <div className="p-4 flex items-center gap-4 relative z-10">
                    <div className="w-16 h-16 rounded-full bg-tiger-gold flex items-center justify-center text-black shadow-lg shadow-yellow-500/20">
                       <Medal size={32} />
                    </div>
                    <div className="flex-1">
                       <div className="text-xs font-bold text-tiger-gold uppercase tracking-widest mb-1">Player of the Match</div>
                       <div className="text-xl font-black text-white">{mvp.name}</div>
                       <div className="text-xs text-gray-400 font-medium">{mvp.teamName}</div>
                    </div>
                    <div className="text-right">
                       <div className="text-sm font-bold text-white">{mvp.runs} Runs</div>
                       {mvp.wickets > 0 && <div className="text-sm font-bold text-white">{mvp.wickets} Wickets</div>}
                       <div className="text-[10px] text-gray-500 mt-1">{mvp.points} Pts</div>
                    </div>
                 </div>
              </div>
            )}

            {/* --- AI REPORT --- */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-md">
              <h3 className="text-xs font-bold text-tiger-gold uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-tiger-gold rounded-full animate-pulse" /> AI Match Analysis
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed pl-4 border-l-2 border-gray-600 italic">
                "{report}"
              </p>
            </div>

            {/* --- WORM GRAPH --- */}
            {!isInnings1 && (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                        <TrendingUp size={14} /> Run Rate Comparison (The Worm)
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={wormData}>
                                <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} label={{ value: 'Overs', position: 'insideBottom', offset: -5, fill: '#6b7280', fontSize: 10 }} />
                                <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                <Line type="monotone" dataKey={matchState.firstInningsScore?.teamName || 'Team 1'} stroke="#9ca3af" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey={matchState.battingTeam.name} stroke="#fbbf24" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* --- TOP PERFORMERS (Chart) --- */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Top Run Scorers</h3>
              <div className="h-48 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={[...team1.players, ...team2.players].sort((a,b) => b.runs - a.runs).slice(0, 5).map(p => ({ name: p.name.split(' ').pop(), runs: p.runs }))}>
                     <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                     <Tooltip 
                       cursor={{fill: 'transparent'}}
                       contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                       itemStyle={{ color: '#fff' }}
                     />
                     <Bar dataKey="runs" radius={[4, 4, 0, 0]}>
                       {[...Array(5)].map((_, index) => (
                         <Cell key={`cell-${index}`} fill={index === 0 ? '#fbbf24' : '#4b5563'} />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'inn1' || activeTab === 'inn2') && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl">
               <ScorecardModal 
                 matchState={matchState} 
                 onClose={() => setActiveTab('analysis')} 
                 inningsToShow={activeTab === 'inn1' ? 1 : 2}
               />
             </div>
          </div>
        )}

        {/* --- FOOTER ACTIONS --- */}
        <div className="flex gap-4 pt-4 pb-8">
          <button className="flex-1 bg-gray-800 hover:bg-gray-750 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 border border-gray-700 transition-all">
             <Share2 size={18} /> Share Result
          </button>
          <button onClick={() => onSaveAndExit(matchState)} className="flex-1 bg-gradient-to-r from-tiger-gold to-tiger-orange text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-yellow-500/20 hover:scale-[1.02] transition-all">
             <Home size={18} /> Return Home
          </button>
        </div>

      </div>
    </div>
  );
};