import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MatchState, ExtraType, WicketType, Player, WicketDetails } from '../types';
import { processBall, getPlayer, calculateEconomy } from '../utils/cricketLogic';
import { generateCommentary, askRuleQuestion, generateSpeech } from '../services/geminiService';
import { Mic, Info, RotateCcw, ChevronDown, CheckCircle2, User, Trophy, Handshake, ListChecks, Volume2, VolumeX } from 'lucide-react';
import { ScorecardModal } from './ScorecardModal';
import { speak, playBase64Audio } from '../utils/voiceUtils';

interface Props {
  matchState: MatchState;
  setMatchState: (state: MatchState) => void;
  onUndo: () => void;
  canUndo: boolean;
  onFinish: () => void;
}

export const ScoringDashboard: React.FC<Props> = ({ matchState, setMatchState, onUndo, canUndo, onFinish }) => {
  // Modal States
  const [wicketModalOpen, setWicketModalOpen] = useState(false);
  const [bowlerSelectOpen, setBowlerSelectOpen] = useState(false);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  
  // Wicket Flow States
  const [selectedWicketType, setSelectedWicketType] = useState<WicketType | null>(null);
  const [selectedFielder, setSelectedFielder] = useState<string>('');
  const [whoIsOut, setWhoIsOut] = useState<'striker' | 'nonStriker'>('striker');
  const [wicketRuns, setWicketRuns] = useState<number>(0);
  const [nextBatsmanSelectOpen, setNextBatsmanSelectOpen] = useState(false);
  const [replacingSide, setReplacingSide] = useState<'striker' | 'nonStriker' | null>(null);

  const [extraType, setExtraType] = useState<ExtraType>(ExtraType.NONE);
  const [commentary, setCommentary] = useState<string>("Waiting for next ball...");
  const [aiLoading, setAiLoading] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  
  const timelineRef = useRef<HTMLDivElement>(null);

  const striker = getPlayer(matchState.battingTeam.players, matchState.strikerId);
  const nonStriker = getPlayer(matchState.battingTeam.players, matchState.nonStrikerId);
  const bowler = getPlayer(matchState.bowlingTeam.players, matchState.currentBowlerId);

  // Auto-prompt for bowler change
  useEffect(() => {
    if (matchState.currentBall === 0 && matchState.currentOver > 0 && matchState.ballHistory.length > 0) {
      setBowlerSelectOpen(true);
    }
  }, [matchState.currentOver]);

  // Handle innings break or match end
  useEffect(() => {
    if (matchState.matchStatus === 'COMPLETED' || matchState.matchStatus === 'INNINGS_BREAK') {
      onFinish();
    }
  }, [matchState.matchStatus]);

  // --- PARTNERSHIP LOGIC ---
  const currentPartnership = useMemo(() => {
    const history = matchState.ballHistory;
    let runs = 0;
    let balls = 0;

    // Iterate backwards until the last wicket or start of innings
    for (let i = history.length - 1; i >= 0; i--) {
      const ball = history[i];
      // Note: If we are in 2nd innings, we must stop if we hit the boundary of 1st innings
      // The history contains both innings mixed if we don't clear it, 
      // but App.tsx clears history on innings break for 2nd innings state? 
      // Actually App.tsx keeps separate matchState, but let's be safe:
      if (ball.inningsNumber !== matchState.inningsNumber) break; 

      if (ball.isWicket) break;

      runs += ball.runs + ball.extraRuns;
      if (ball.isLegalBall) balls++;
    }
    return { runs, balls };
  }, [matchState.ballHistory, matchState.inningsNumber]);


  const resetWicketState = () => {
    setWicketModalOpen(false);
    setSelectedWicketType(null);
    setSelectedFielder('');
    setWhoIsOut('striker');
    setWicketRuns(0);
  };

  const handleScore = (runs: number) => {
    processAndSetState(runs, false, undefined);
  };

  const handleWicketConfirm = () => {
    if (!selectedWicketType) return;
    
    // For Run Out, we allow runs completed
    const r = selectedWicketType === WicketType.RUN_OUT ? wicketRuns : 0;
    
    const wicketDetails: WicketDetails = {
      type: selectedWicketType,
      fielderName: selectedFielder || undefined,
      isStrikerOut: whoIsOut === 'striker'
    };

    // Check if any players left before opening modal
    const outCount = matchState.wickets + 1;
    const isAllOut = outCount >= 10 || outCount >= matchState.battingTeam.players.length - 1;

    if (isAllOut) {
      processAndSetState(r, true, wicketDetails);
      resetWicketState();
    } else {
      processAndSetState(r, true, wicketDetails);
      setReplacingSide(whoIsOut);
      setNextBatsmanSelectOpen(true);
      resetWicketState();
    }
  };

  const processAndSetState = (runs: number, isWicket: boolean, wicketDetails: WicketDetails | undefined) => {
    const newState = processBall(matchState, runs, extraType, isWicket, wicketDetails);
    setMatchState(newState);
    
    setExtraType(ExtraType.NONE);

    setAiLoading(true);
    const lastEvent = newState.ballHistory[newState.ballHistory.length - 1];
    if (lastEvent) {
      generateCommentary(lastEvent, newState).then(async (text) => {
        setCommentary(text);
        setAiLoading(false);
        if (isVoiceEnabled) {
          // Try high-quality Gemini TTS first
          const audioData = await generateSpeech(text);
          if (audioData) {
            playBase64Audio(audioData);
          } else {
            // Fallback to basic browser synthesis
            speak(text);
          }
        }
      });
    } else {
      setAiLoading(false);
    }
  };

  const handleSelectNextBatsman = (playerId: string) => {
    if (!replacingSide) return;
    
    const newState = { ...matchState };
    if (replacingSide === 'striker') {
      newState.strikerId = playerId;
    } else {
      newState.nonStrikerId = playerId;
    }
    
    setMatchState(newState);
    setNextBatsmanSelectOpen(false);
    setReplacingSide(null);
  };

  const handleChangeBowler = (bowlerId: string) => {
    const newState = { ...matchState, currentBowlerId: bowlerId };
    setMatchState(newState);
    setBowlerSelectOpen(false);
  };

  const getLabel = (runVal: number) => {
    if (extraType === ExtraType.WIDE) return `WD + ${runVal}`;
    if (extraType === ExtraType.NO_BALL) return `NB + ${runVal}`;
    if (extraType === ExtraType.BYE) return `${runVal} B`;
    if (extraType === ExtraType.LEG_BYE) return `${runVal} LB`;
    return runVal.toString();
  };

  const needsFielder = selectedWicketType === WicketType.CAUGHT || selectedWicketType === WicketType.RUN_OUT || selectedWicketType === WicketType.STUMPED;

  return (
    <div className="flex flex-col h-full bg-tiger-black font-sans text-white overflow-hidden relative">
      
      {/* PROFESSIONAL SCOREBOARD HEADER */}
      <div className="flex-shrink-0 bg-gradient-to-b from-gray-900 to-gray-800 shadow-xl border-b border-gray-700">
        
        {/* Top Bar: Match Overview - Very compact */}
        <div className="px-3 py-1 flex justify-between items-center bg-black/40 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
          <div>{matchState.battingTeam.name} vs {matchState.bowlingTeam.name}</div>
          <div className="flex gap-3 items-center">
             {matchState.isFreeHit && (
               <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse shadow-[0_0_5px_rgba(220,38,38,0.5)]">FREE HIT</span>
             )}
             <span className="text-tiger-gold">{matchState.tossWinner} chose to {matchState.tossDecision}</span>
          </div>
        </div>

        {/* Main Score Area - Reduced padding */}
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white tabular-nums tracking-tight">
                {matchState.totalRuns}/{matchState.wickets}
              </span>
              <span className="text-lg text-tiger-gold font-mono">
                {matchState.currentOver}.{matchState.currentBall} <span className="text-[10px] text-gray-500">ov</span>
              </span>
            </div>
            <div className="text-[10px] font-medium text-gray-400 flex flex-col gap-0.5">
              <div className="flex gap-2">
                 <span>CRR: {((matchState.totalRuns / (matchState.currentOver * 6 + matchState.currentBall || 1)) * 6).toFixed(2)}</span>
                 <span>•</span>
                 <span>Extras: {matchState.extras.wides + matchState.extras.noBalls + matchState.extras.byes + matchState.extras.legByes}</span>
              </div>
              {matchState.target && (
                 <div className="text-tiger-gold font-bold">
                    Need {matchState.target - matchState.totalRuns} in { (matchState.totalOvers * 6) - (matchState.currentOver * 6 + matchState.currentBall) } bls
                 </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1.5">
            {/* PARTNERSHIP WIDGET - Smaller */}
            <div className="bg-gray-800/80 rounded-lg py-1 px-2 border border-gray-700/50 flex items-center gap-2">
               <div className="flex items-center gap-1 text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                  <Handshake size={10} className="text-tiger-gold" /> P'ship
               </div>
               <div className="text-xs font-bold text-white tabular-nums">
                  {currentPartnership.runs} <span className="text-[9px] text-gray-500 font-normal">({currentPartnership.balls})</span>
               </div>
            </div>

            <div className="flex gap-1.5">
              <button 
                  onClick={onUndo} 
                  disabled={!canUndo}
                  className={`p-1.5 rounded text-[10px] font-bold uppercase transition-colors ${canUndo ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-800 text-gray-600'}`}
              >
                <RotateCcw size={10} />
              </button>
              <button 
                onClick={() => setBowlerSelectOpen(true)}
                className="px-2 py-1 rounded bg-tiger-gold/10 text-tiger-gold border border-tiger-gold/30 text-[9px] font-bold uppercase tracking-wider hover:bg-tiger-gold/20 transition-colors"
              >
                Change Bowler
              </button>
            </div>
          </div>
        </div>

        {/* Broadcast Strip - More compact */}
        <div className="grid grid-cols-12 border-t border-gray-700/50 bg-gray-800/50 backdrop-blur-sm">
          {/* Striker */}
          <div className="col-span-5 p-2 border-r border-gray-700/50 flex justify-between items-center relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-tiger-gold"></div>
            <div className="min-w-0 pr-1">
               <div className="text-xs font-bold text-white flex items-center gap-0.5 truncate">
                 {striker?.name} <Trophy size={8} className="text-tiger-gold fill-current" />
               </div>
               <div className="text-[9px] text-gray-400 uppercase tracking-widest leading-none">Striker</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-black text-tiger-gold tabular-nums -mb-1">{striker?.runs}</div>
              <div className="text-[9px] text-gray-500">{striker?.balls}b</div>
            </div>
          </div>
          
          {/* Non-Striker */}
          <div className="col-span-3 p-2 border-r border-gray-700/50 flex flex-col justify-center opacity-70 min-w-0">
            <div className="text-[10px] font-bold text-gray-300 truncate">{nonStriker?.name}</div>
            <div className="text-[9px] text-gray-500">{nonStriker?.runs} ({nonStriker?.balls})</div>
          </div>

          {/* Bowler */}
          <div className="col-span-4 p-2 flex justify-between items-center bg-gray-900/40 min-w-0">
            <div className="truncate pr-1">
               <div className="text-xs font-bold text-white truncate">{bowler?.name}</div>
               <div className="text-[9px] text-gray-400 uppercase tracking-widest leading-none">Bowler</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs font-bold text-blue-400 tabular-nums">{bowler?.wickets}-{bowler?.runsConceded}</div>
              <div className="text-[9px] text-gray-500">{Math.floor((bowler?.ballsBowled || 0)/6)}.{ (bowler?.ballsBowled || 0)%6 }</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Timeline - Compact */}
      <div className="flex-shrink-0 bg-black/60 backdrop-blur border-b border-gray-800 p-1.5 overflow-x-auto whitespace-nowrap no-scrollbar flex items-center" ref={timelineRef}>
        <span className="text-[9px] font-bold text-gray-500 uppercase mr-2 sticky left-0 bg-transparent">Last:</span>
        {matchState.ballHistory.slice(-10).reverse().map((ball, idx) => (
          <div key={idx} className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[9px] font-bold mr-1.5 border border-opacity-30 
            ${ball.isWicket ? 'bg-red-500/20 border-red-500 text-red-400' : 
              ball.runs >= 4 ? 'bg-tiger-gold text-black border-tiger-gold' : 
              'bg-gray-800 border-gray-600 text-gray-300'}`}>
            {ball.isWicket ? 'W' : ball.extraType !== ExtraType.NONE ? (ball.runs + ball.extraRuns) + (ball.extraType[0]) : ball.runs}
          </div>
        ))}
      </div>

      {/* Commentary Strip - Shorter */}
      <div className="flex-shrink-0 px-3 py-2 bg-tiger-gold/5 border-b border-tiger-gold/10 flex items-start gap-2 max-h-16 overflow-y-auto no-scrollbar relative">
        <Mic size={12} className={`text-tiger-gold mt-1 flex-shrink-0 ${aiLoading ? 'animate-pulse' : ''}`} />
        <p className="text-[10px] text-gray-300 leading-tight font-medium pr-8">
          {commentary}
        </p>
        <button 
          onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
          className={`absolute right-3 top-2 p-1 rounded-full transition-all ${isVoiceEnabled ? 'text-tiger-gold' : 'text-gray-600'}`}
          title={isVoiceEnabled ? "Mute Voice" : "Unmute Voice"}
        >
          {isVoiceEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
        </button>
      </div>

      {/* CONTROLS AREA - Take remaining space but stay visible */}
      <div className="flex-1 p-3 pb-6 flex flex-col justify-center gap-2 bg-gradient-to-t from-black to-gray-900 overflow-hidden">
        
        {/* Extras Row */}
        <div className="grid grid-cols-4 gap-1.5">
           {[ExtraType.WIDE, ExtraType.NO_BALL, ExtraType.BYE, ExtraType.LEG_BYE].map((type) => (
             <button
                key={type}
                onClick={() => setExtraType(extraType === type ? ExtraType.NONE : type)}
                className={`py-2 text-[9px] font-bold uppercase rounded-lg transition-all border ${
                  extraType === type 
                  ? 'bg-tiger-orange border-tiger-gold text-white shadow-[0_0_8px_rgba(251,191,36,0.5)]' 
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
             >
               {type === ExtraType.NO_BALL ? 'No Ball' : type}
             </button>
           ))}
        </div>

        {/* Main Runs Grid - Reordered and standardized */}
        <div className="grid grid-cols-4 gap-2 flex-1 max-h-64">
          {[0, 1, 2, 3].map(val => (
            <button 
              key={val}
              onClick={() => handleScore(val)} 
              className="h-full min-h-[48px] rounded-lg bg-gray-800 border-b-4 border-gray-950 hover:bg-gray-700 active:border-b-0 active:translate-y-1 transition-all text-xl font-bold text-white shadow-lg"
            >
              {getLabel(val)}
            </button>
          ))}
          
          <button onClick={() => handleScore(4)} className="h-full min-h-[48px] rounded-lg bg-tiger-gold border-b-4 border-tiger-orange hover:bg-yellow-400 active:border-b-0 active:translate-y-1 transition-all text-2xl font-black text-black shadow-lg">4</button>
          <button onClick={() => handleScore(5)} className="h-full min-h-[48px] rounded-lg bg-gray-800 border-b-4 border-gray-950 hover:bg-gray-700 active:border-b-0 active:translate-y-1 transition-all text-xl font-bold text-white shadow-lg">{getLabel(5)}</button>
          <button onClick={() => handleScore(6)} className="h-full min-h-[48px] rounded-lg bg-tiger-gold border-b-4 border-tiger-orange hover:bg-yellow-400 active:border-b-0 active:translate-y-1 transition-all text-2xl font-black text-black shadow-lg">6</button>
          
          <button 
            onClick={() => setWicketModalOpen(true)} 
            className="h-full min-h-[48px] rounded-lg bg-red-600 border-b-4 border-red-800 hover:bg-red-500 active:border-b-0 active:translate-y-1 transition-all text-sm font-black text-white shadow-lg tracking-wider"
          >
             WICKET
          </button>
        </div>

        {/* AI Help - Even smaller */}
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => setScorecardOpen(true)}
            className="py-2 bg-gray-800/30 text-gray-300 text-[10px] font-bold uppercase rounded-lg flex items-center justify-center gap-1.5 border border-gray-700 hover:bg-gray-800 transition-colors"
          >
            <ListChecks size={12} className="text-tiger-gold" /> Scorecard
          </button>
          <button 
            onClick={() => {
              setAiLoading(true);
              askRuleQuestion("What is the fielding restriction in powerplay?").then(ans => {
                 alert(ans);
                 setAiLoading(false);
              });
            }} 
            className="py-1.5 bg-gray-800/30 text-gray-600 text-[9px] rounded-lg flex items-center justify-center gap-1.5 border border-dashed border-gray-700 hover:text-gray-400 transition-colors"
          >
            <Info size={10} /> Rules AI
          </button>
        </div>
      </div>

      {/* --- ADVANCED WICKET MODAL --- */}
      {wicketModalOpen && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-gray-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-4 bg-red-900/20 border-b border-red-900/30 flex justify-between items-center">
               <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                 Wicket Fall
               </h3>
               <button onClick={resetWicketState} className="text-gray-400 hover:text-white text-xs">CANCEL</button>
            </div>

            <div className="p-4 overflow-y-auto space-y-6">
              <div className="space-y-3">
                 <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Method of Dismissal</label>
                 <div className="grid grid-cols-2 gap-2">
                    {Object.values(WicketType).map((w) => (
                      <button 
                        key={w}
                        onClick={() => {
                          setSelectedWicketType(w);
                          if(w === WicketType.BOWLED || w === WicketType.LBW || w === WicketType.HIT_WICKET) {
                            setSelectedFielder('');
                          }
                        }}
                        className={`py-3 px-4 rounded-lg text-sm font-semibold text-left transition-all border ${
                          selectedWicketType === w 
                          ? 'bg-red-600 border-red-500 text-white shadow-lg' 
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                 </div>
              </div>

              {selectedWicketType && (
                 <div className="space-y-6 animate-in slide-in-from-bottom-2">
                    {selectedWicketType === WicketType.RUN_OUT && (
                       <div className="space-y-3">
                         <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Who is out?</label>
                         <div className="flex gap-2">
                           <button 
                              onClick={() => setWhoIsOut('striker')}
                              className={`flex-1 py-3 rounded-lg border text-sm font-bold ${whoIsOut === 'striker' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                           >
                             {striker?.name} (Striker)
                           </button>
                           <button 
                              onClick={() => setWhoIsOut('nonStriker')}
                              className={`flex-1 py-3 rounded-lg border text-sm font-bold ${whoIsOut === 'nonStriker' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                           >
                             {nonStriker?.name} (Non-Striker)
                           </button>
                         </div>
                       </div>
                    )}
                    {needsFielder && (
                      <div className="space-y-3">
                         <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                           {selectedWicketType === WicketType.CAUGHT ? 'Caught By' : 'Fielder Involved'}
                         </label>
                         <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                            {matchState.bowlingTeam.players.map(p => (
                              <button
                                key={p.id}
                                onClick={() => setSelectedFielder(p.name)}
                                className={`py-2 px-3 rounded text-xs font-medium text-left truncate border ${
                                  selectedFielder === p.name
                                  ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                                }`}
                              >
                                {p.name}
                              </button>
                            ))}
                         </div>
                      </div>
                    )}
                 </div>
              )}
            </div>

            <div className="p-4 bg-gray-800 border-t border-gray-700">
               <button 
                 disabled={!selectedWicketType || (needsFielder && !selectedFielder)}
                 onClick={handleWicketConfirm}
                 className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg shadow-lg transition-all"
               >
                 CONFIRM WICKET
               </button>
            </div>

          </div>
        </div>
      )}

      {/* --- NEXT BATSMAN MODAL --- */}
      {nextBatsmanSelectOpen && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
           <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-tiger-gold/20 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="p-6 text-center border-b border-gray-800 bg-tiger-gold/5">
                <Trophy className="mx-auto mb-2 text-tiger-gold" size={32} />
                <h3 className="text-xl font-bold text-white">New Batsman</h3>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">Select replacement for {replacingSide}</p>
             </div>
             <div className="max-h-[50vh] overflow-y-auto p-4 space-y-2 no-scrollbar">
                {matchState.battingTeam.players
                  .filter(p => !p.isOut && p.id !== matchState.strikerId && p.id !== matchState.nonStrikerId)
                  .map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectNextBatsman(p.id)}
                    className="w-full p-4 bg-gray-800 hover:bg-gray-750 rounded-xl flex justify-between items-center border border-gray-700 group transition-all"
                  >
                    <div className="text-left flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-tiger-gold font-bold border border-gray-600">
                         {p.name[0]}
                       </div>
                       <div className="font-semibold text-gray-200 group-hover:text-white uppercase tracking-tight">{p.name}</div>
                    </div>
                    <div className="bg-tiger-gold/10 text-tiger-gold px-2 py-1 rounded text-[10px] font-bold">SELECT</div>
                  </button>
                ))}
                {matchState.battingTeam.players.filter(p => !p.isOut && p.id !== matchState.strikerId && p.id !== matchState.nonStrikerId).length === 0 && (
                   <div className="text-center p-8 text-gray-500 italic">No more batsmen available.</div>
                )}
             </div>
           </div>
        </div>
      )}

      {/* Bowler Select Modal */}
      {bowlerSelectOpen && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
           <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
             <div className="p-6 text-center border-b border-gray-800">
                <h3 className="text-xl font-bold text-white">Select New Bowler</h3>
                <p className="text-xs text-gray-500 mt-1">Previous over completed</p>
             </div>
             <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
                {matchState.bowlingTeam.players.filter(p => p.id !== matchState.currentBowlerId).map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleChangeBowler(p.id)}
                    className="w-full p-4 bg-gray-800 hover:bg-gray-750 rounded-xl flex justify-between items-center border border-gray-700 group transition-all"
                  >
                    <div className="text-left">
                       <div className="font-semibold text-gray-200 group-hover:text-white">{p.name}</div>
                       <div className="text-xs text-gray-500">{Math.floor(p.ballsBowled/6)}.{p.ballsBowled%6} ov • {p.wickets} wkts</div>
                    </div>
                    <ChevronDown className="-rotate-90 text-gray-600 group-hover:text-white" size={16} />
                  </button>
                ))}
             </div>
           </div>
        </div>
      )}

      {scorecardOpen && (
        <ScorecardModal 
          matchState={matchState} 
          onClose={() => setScorecardOpen(false)} 
        />
      )}

    </div>
  );
};