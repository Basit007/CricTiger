import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MatchState, ExtraType, WicketType, Player, WicketDetails } from '../types';
import { 
  processBall, 
  getPlayer, 
  calculateEconomy, 
  getMaxBowlerOvers, 
  getPowerplayStatus, 
  checkBowlerEligibility,
  getPowerplayOvers,
  retireBatsman,
  declareInnings,
  concludeMatchEarly,
  getEligibleBowlersCount
} from '../utils/cricketLogic';
import { generateCommentary, askRuleQuestion, generateSpeech } from '../services/geminiService';
import { 
  Mic, 
  Info, 
  RotateCcw, 
  ChevronDown, 
  CheckCircle2, 
  User, 
  Trophy, 
  Handshake, 
  ListChecks, 
  Volume2, 
  VolumeX, 
  Zap, 
  ShieldAlert, 
  AlertTriangle, 
  X, 
  HelpCircle,
  Target,
  CloudRain,
  Flag,
  UserMinus
} from 'lucide-react';
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
  const [powerplayModalOpen, setPowerplayModalOpen] = useState(false);
  const [allowEmergencyOverride, setAllowEmergencyOverride] = useState(false);

  // Retirement & Declaration States
  const [retireModalOpen, setRetireModalOpen] = useState(false);
  const [batsmanToRetire, setBatsmanToRetire] = useState<'striker' | 'nonStriker'>('striker');
  const [retireType, setRetireType] = useState<WicketType.RETIRED_HURT | WicketType.RETIRED_OUT>(WicketType.RETIRED_HURT);

  const [declareModalOpen, setDeclareModalOpen] = useState(false);
  const [declarationTab, setDeclarationTab] = useState<'innings' | 'rain'>('innings');
  const [rainReason, setRainReason] = useState<'RAIN_ABANDONED' | 'RAIN_DLS' | 'MUTUAL_DRAW' | 'CONCEDED'>('RAIN_ABANDONED');
  const [customResultInput, setCustomResultInput] = useState('');
  const [dlsWinner, setDlsWinner] = useState(matchState.battingTeam.name);
  
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
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false); // Default to false to avoid AudioContext lockups
  
  const timelineRef = useRef<HTMLDivElement>(null);

  const striker = getPlayer(matchState.battingTeam.players, matchState.strikerId);
  const nonStriker = getPlayer(matchState.battingTeam.players, matchState.nonStrikerId);
  const bowler = getPlayer(matchState.bowlingTeam.players, matchState.currentBowlerId);
  const lastOverBowler = matchState.lastOverBowlerId ? getPlayer(matchState.bowlingTeam.players, matchState.lastOverBowlerId) : undefined;

  // Format limits & powerplay status
  const maxBowlerOvers = useMemo(() => {
    return getMaxBowlerOvers(matchState.totalOvers);
  }, [matchState.totalOvers]);

  const powerplay = useMemo(() => {
    return getPowerplayStatus(matchState.currentOver, matchState.currentBall, matchState.totalOvers);
  }, [matchState.currentOver, matchState.currentBall, matchState.totalOvers]);

  const eligibleBowlersCount = useMemo(() => {
    return getEligibleBowlersCount(
      matchState.bowlingTeam.players,
      matchState.currentBowlerId,
      matchState.lastOverBowlerId,
      matchState.totalOvers,
      matchState.currentBall === 0
    );
  }, [matchState.bowlingTeam.players, matchState.currentBowlerId, matchState.lastOverBowlerId, matchState.totalOvers, matchState.currentBall]);

  // Auto-prompt for bowler selection when an over completes or bowler is unset
  useEffect(() => {
    if (!matchState.currentBowlerId && matchState.matchStatus === 'LIVE') {
      setBowlerSelectOpen(true);
    }
  }, [matchState.currentBowlerId, matchState.matchStatus, matchState.currentOver]);

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

    for (let i = history.length - 1; i >= 0; i--) {
      const ball = history[i];
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
    if (!matchState.currentBowlerId) {
      setBowlerSelectOpen(true);
      return;
    }
    processAndSetState(runs, false, undefined);
  };

  const handleWicketButtonClick = () => {
    if (!matchState.currentBowlerId) {
      setBowlerSelectOpen(true);
      return;
    }
    setWicketModalOpen(true);
  };

  const handleWicketConfirm = () => {
    if (!selectedWicketType) return;
    
    const r = selectedWicketType === WicketType.RUN_OUT ? wicketRuns : 0;
    
    const wicketDetails: WicketDetails = {
      type: selectedWicketType,
      fielderName: selectedFielder || undefined,
      isStrikerOut: whoIsOut === 'striker'
    };

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
          try {
            const audioData = await generateSpeech(text);
            if (audioData) {
              await playBase64Audio(audioData);
            } else {
              speak(text);
            }
          } catch (e) {
            console.warn("Audio speech skipped:", e);
          }
        }
      }).catch((err) => {
        console.warn("Commentary skipped:", err);
        setAiLoading(false);
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

  const handleConfirmRetirement = () => {
    const batterId = batsmanToRetire === 'striker' ? matchState.strikerId : matchState.nonStrikerId;
    if (!batterId) return;

    const availableNext = matchState.battingTeam.players.filter(
      p => !p.isOut && p.id !== matchState.strikerId && p.id !== matchState.nonStrikerId
    );

    const newState = retireBatsman(matchState, batterId, retireType);
    setMatchState(newState);
    setRetireModalOpen(false);

    if (availableNext.length > 0) {
      setReplacingSide(batsmanToRetire);
      setNextBatsmanSelectOpen(true);
    }
  };

  const handleConfirmDeclaration = () => {
    const newState = declareInnings(matchState, 'Innings declared by batting captain');
    setMatchState(newState);
    setDeclareModalOpen(false);
  };

  const handleConfirmEarlyConclusion = () => {
    const newState = concludeMatchEarly(
      matchState,
      rainReason,
      customResultInput.trim() || undefined,
      dlsWinner
    );
    setMatchState(newState);
    setDeclareModalOpen(false);
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
        
        {/* Top Bar: Match Overview & Powerplay Pill */}
        <div className="px-3 py-1 flex justify-between items-center bg-black/40 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
          <div className="truncate pr-2">{matchState.battingTeam.name} vs {matchState.bowlingTeam.name}</div>
          <div className="flex gap-2 items-center flex-shrink-0">
             {/* Powerplay Pill Button */}
             {powerplay.isPowerplay ? (
               <button 
                 onClick={() => setPowerplayModalOpen(true)}
                 className="flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] px-2 py-0.5 rounded-full font-black animate-pulse hover:bg-amber-500/30 transition-all cursor-pointer shadow-[0_0_8px_rgba(245,158,11,0.25)]"
                 title="Click to view Powerplay Rules"
               >
                 <Zap size={10} className="fill-amber-400 text-amber-400" />
                 <span>{powerplay.phaseName}</span>
                 <span className="opacity-80">({powerplay.oversRemaining} ov left)</span>
               </button>
             ) : (
               <button
                 onClick={() => setPowerplayModalOpen(true)}
                 className="flex items-center gap-1 bg-gray-800 text-gray-400 border border-gray-700 text-[9px] px-2 py-0.5 rounded-full font-bold hover:text-white transition-colors"
                 title="Click to view match rules"
               >
                 <span>⚡ Normal Field</span>
               </button>
             )}

             {matchState.isFreeHit && (
               <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse shadow-[0_0_5px_rgba(220,38,38,0.5)]">FREE HIT</span>
             )}
             <span className="text-tiger-gold hidden sm:inline">{matchState.tossWinner} chose to {matchState.tossDecision}</span>
          </div>
        </div>

        {/* Main Score Area */}
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
            {/* PARTNERSHIP WIDGET */}
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
                  title="Undo last ball"
              >
                <RotateCcw size={10} />
              </button>
              <button 
                onClick={() => setBowlerSelectOpen(true)}
                className="px-2 py-1 rounded bg-tiger-gold/10 text-tiger-gold border border-tiger-gold/30 text-[9px] font-bold uppercase tracking-wider hover:bg-tiger-gold/20 transition-colors flex items-center gap-1"
              >
                <span>{matchState.currentBowlerId ? 'Change Bowler' : 'Select Bowler'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Powerplay / Fielding Context Strip */}
        <div className="px-4 py-1 bg-black/30 border-t border-gray-800 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5 truncate text-gray-300">
            {powerplay.isPowerplay ? (
              <>
                <Zap size={11} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                <span className="font-bold text-amber-300">{powerplay.phaseName}:</span>
                <span className="truncate">{powerplay.fieldingRestriction}</span>
              </>
            ) : (
              <>
                <span className="text-gray-400">Fielding:</span>
                <span className="text-gray-300">Standard field (Max 5 outside circle)</span>
              </>
            )}
          </div>
          <div className="text-[9px] font-mono text-gray-400 flex-shrink-0 ml-2">
            Quota: {maxBowlerOvers} ov/bowler
          </div>
        </div>

        {/* Broadcast Strip: Striker, Non-Striker, Bowler with Over Quota */}
        <div className="grid grid-cols-12 border-t border-gray-700/50 bg-gray-800/50 backdrop-blur-sm">
          {/* Striker */}
          <div className="col-span-5 p-2 border-r border-gray-700/50 flex justify-between items-center relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-tiger-gold"></div>
            <div className="min-w-0 pr-1">
               <div className="text-xs font-bold text-white flex items-center gap-0.5 truncate">
                 {striker?.name} <Trophy size={8} className="text-tiger-gold fill-current" />
               </div>
               <div className="flex items-center gap-1.5 mt-0.5">
                 <span className="text-[9px] text-gray-400 uppercase tracking-widest leading-none">Striker</span>
                 <button
                   onClick={(e) => {
                     e.stopPropagation();
                     setBatsmanToRetire('striker');
                     setRetireType(WicketType.RETIRED_HURT);
                     setRetireModalOpen(true);
                   }}
                   className="text-[8px] text-amber-400/90 hover:text-amber-300 font-bold uppercase tracking-wider flex items-center gap-0.5 border border-amber-500/30 rounded px-1 hover:bg-amber-500/10 transition-colors"
                   title="Retire striker (Hurt/Out)"
                 >
                   <UserMinus size={8} /> Retire
                 </button>
               </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-black text-tiger-gold tabular-nums -mb-1">{striker?.runs}</div>
              <div className="text-[9px] text-gray-500">{striker?.balls}b</div>
            </div>
          </div>
          
          {/* Non-Striker */}
          <div className="col-span-3 p-2 border-r border-gray-700/50 flex flex-col justify-center opacity-85 min-w-0">
            <div className="text-[10px] font-bold text-gray-300 truncate">{nonStriker?.name}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[9px] text-gray-500">{nonStriker?.runs} ({nonStriker?.balls})</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setBatsmanToRetire('nonStriker');
                  setRetireType(WicketType.RETIRED_HURT);
                  setRetireModalOpen(true);
                }}
                className="text-[8px] text-gray-400 hover:text-amber-300 border border-gray-700 rounded px-1 hover:bg-gray-700/40 transition-colors"
                title="Retire non-striker"
              >
                Retire
              </button>
            </div>
          </div>

          {/* Bowler with Quota Progress */}
          <div 
            onClick={() => setBowlerSelectOpen(true)}
            className="col-span-4 p-2 flex justify-between items-center bg-gray-900/40 min-w-0 cursor-pointer hover:bg-gray-900/70 transition-colors"
            title="Click to view or change bowler"
          >
            <div className="truncate pr-1">
               <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                 <span>{bowler?.name || 'Select Bowler'}</span>
                 {!bowler && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
               </div>
               <div className="text-[9px] text-gray-400 uppercase tracking-widest leading-none">
                 Bowler {bowler && `(${Math.floor(bowler.ballsBowled / 6)}.${bowler.ballsBowled % 6} / ${maxBowlerOvers} ov)`}
               </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs font-bold text-blue-400 tabular-nums">{bowler?.wickets ?? 0}-{bowler?.runsConceded ?? 0}</div>
              <div className="text-[9px] text-gray-500 font-mono">
                {bowler ? `${Math.floor(bowler.ballsBowled / 6)}.${bowler.ballsBowled % 6}` : '0.0'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Timeline */}
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

      {/* Commentary Strip */}
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

      {/* CONTROLS AREA */}
      <div className="flex-1 p-3 pb-6 flex flex-col justify-center gap-2 bg-gradient-to-t from-black to-gray-900 overflow-hidden">
        
        {/* Banner if Bowler is NOT selected for the over */}
        {!matchState.currentBowlerId && (
          <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-2.5 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 animate-bounce" />
              <div>
                <div className="text-xs font-black text-amber-300">Over {matchState.currentOver + 1} Ready</div>
                <div className="text-[10px] text-gray-300">Select bowler to begin over</div>
              </div>
            </div>
            <button 
              onClick={() => setBowlerSelectOpen(true)}
              className="px-3 py-1.5 bg-tiger-gold hover:bg-yellow-400 text-black text-xs font-black uppercase tracking-wider rounded-lg shadow transition-all active:scale-95"
            >
              Choose Bowler
            </button>
          </div>
        )}

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

        {/* Main Runs Grid */}
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
            onClick={handleWicketButtonClick} 
            className="h-full min-h-[48px] rounded-lg bg-red-600 border-b-4 border-red-800 hover:bg-red-500 active:border-b-0 active:translate-y-1 transition-all text-sm font-black text-white shadow-lg tracking-wider"
          >
             WICKET
          </button>
        </div>

        {/* Utility bar: Scorecard, Rain/Declaration, Rules */}
        <div className="grid grid-cols-3 gap-1.5">
          <button 
            onClick={() => setScorecardOpen(true)}
            className="py-2 bg-gray-800/40 text-gray-300 text-[10px] font-bold uppercase rounded-lg flex items-center justify-center gap-1 border border-gray-700 hover:bg-gray-800 transition-colors"
          >
            <ListChecks size={11} className="text-tiger-gold" /> Scorecard
          </button>
          <button 
            onClick={() => setDeclareModalOpen(true)}
            className="py-2 bg-amber-500/10 text-amber-300 text-[10px] font-bold uppercase rounded-lg flex items-center justify-center gap-1 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
            title="Declare innings or abandon/finish match due to rain or other reason"
          >
            <CloudRain size={11} className="text-amber-400" /> Rain/Declare
          </button>
          <button 
            onClick={() => setPowerplayModalOpen(true)}
            className="py-2 bg-gray-800/40 text-gray-300 text-[10px] font-bold uppercase rounded-lg flex items-center justify-center gap-1 border border-gray-700 hover:bg-gray-800 transition-colors"
          >
            <Zap size={11} className="text-amber-400" /> Rules & PP
          </button>
        </div>

      </div>

      {/* WICKET MODAL */}
      {wicketModalOpen && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
           <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-4 bg-red-600/10 border-b border-red-500/20 text-center">
                 <h3 className="text-base font-black uppercase text-red-500 tracking-wider">Record Wicket</h3>
                 <p className="text-[10px] text-gray-400">Select dismissal details</p>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                 {/* WHO IS OUT? */}
                 <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Who was dismissed?</label>
                    <div className="grid grid-cols-2 gap-2">
                       <button
                         onClick={() => setWhoIsOut('striker')}
                         className={`p-2.5 rounded-xl border text-left flex flex-col justify-center transition-all ${
                            whoIsOut === 'striker' ? 'bg-red-500/20 border-red-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'
                         }`}
                       >
                          <span className="text-xs font-bold truncate">{striker?.name}</span>
                          <span className="text-[9px] uppercase tracking-wider text-tiger-gold">Striker</span>
                       </button>
                       <button
                         onClick={() => setWhoIsOut('nonStriker')}
                         className={`p-2.5 rounded-xl border text-left flex flex-col justify-center transition-all ${
                            whoIsOut === 'nonStriker' ? 'bg-red-500/20 border-red-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'
                         }`}
                       >
                          <span className="text-xs font-bold truncate">{nonStriker?.name}</span>
                          <span className="text-[9px] uppercase tracking-wider text-gray-400">Non-Striker</span>
                       </button>
                    </div>
                 </div>

                 {/* DISMISSAL METHOD */}
                 <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Dismissal Method</label>
                    <div className="grid grid-cols-2 gap-1.5">
                       {[
                         WicketType.BOWLED,
                         WicketType.CAUGHT,
                         WicketType.LBW,
                         WicketType.RUN_OUT,
                         WicketType.STUMPED,
                         WicketType.HIT_WICKET
                       ].map((wType) => {
                          const isFreeHit = matchState.isFreeHit;
                          const disabledOnFreeHit = isFreeHit && wType !== WicketType.RUN_OUT;

                          return (
                            <button
                              key={wType}
                              disabled={disabledOnFreeHit}
                              onClick={() => setSelectedWicketType(wType)}
                              className={`p-2 text-xs font-bold uppercase rounded-lg border text-center transition-all ${
                                 selectedWicketType === wType
                                   ? 'bg-red-600 border-red-500 text-white shadow-md'
                                   : disabledOnFreeHit
                                   ? 'bg-gray-800/40 border-gray-800 text-gray-600 cursor-not-allowed'
                                   : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750'
                              }`}
                            >
                               {wType}
                            </button>
                          );
                       })}
                    </div>
                    {matchState.isFreeHit && (
                      <p className="text-[9px] text-amber-400 font-bold mt-1">
                        ⚠️ Free Hit in play: Only Run Out is valid.
                      </p>
                    )}
                 </div>

                 {/* RUNS COMPLETED (RUN OUT ONLY) */}
                 {selectedWicketType === WicketType.RUN_OUT && (
                   <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Runs completed before run out</label>
                      <div className="flex gap-2">
                        {[0, 1, 2, 3].map((r) => (
                           <button
                             key={r}
                             onClick={() => setWicketRuns(r)}
                             className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${
                               wicketRuns === r ? 'bg-tiger-gold text-black border-tiger-gold' : 'bg-gray-800 border-gray-700 text-gray-300'
                             }`}
                           >
                             {r}
                           </button>
                        ))}
                      </div>
                   </div>
                 )}

                 {/* FIELDER SELECTION */}
                 {needsFielder && (
                   <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Fielder Involved</label>
                      <select
                        value={selectedFielder}
                        onChange={(e) => setSelectedFielder(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-white p-2 rounded-lg text-xs outline-none focus:border-red-500"
                      >
                         <option value="">Select Fielder (Optional)</option>
                         {matchState.bowlingTeam.players.map((p) => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                         ))}
                      </select>
                   </div>
                 )}
              </div>

              {/* FOOTER ACTIONS */}
              <div className="p-3 border-t border-gray-800 flex gap-2 bg-gray-950">
                 <button
                   onClick={resetWicketState}
                   className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white font-bold text-xs uppercase"
                 >
                    Cancel
                 </button>
                 <button
                   disabled={!selectedWicketType}
                   onClick={handleWicketConfirm}
                   className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                      selectedWicketType ? 'bg-red-600 text-white shadow-lg hover:bg-red-500' : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                   }`}
                 >
                    Confirm Out
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* NEXT BATSMAN SELECT MODAL */}
      {nextBatsmanSelectOpen && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
           <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
             <div className="p-6 text-center border-b border-gray-800">
                <h3 className="text-xl font-black text-white uppercase tracking-wider">Next Batsman</h3>
                <p className="text-xs text-gray-400 mt-1">Select incoming batsman</p>
             </div>
             <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
                {matchState.battingTeam.players
                  .filter(p => !p.isOut && p.id !== matchState.strikerId && p.id !== matchState.nonStrikerId)
                  .map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectNextBatsman(p.id)}
                    className="w-full p-4 bg-gray-800 hover:bg-gray-750 rounded-xl flex justify-between items-center border border-gray-700 group transition-all"
                  >
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-tiger-gold/20 text-tiger-gold flex items-center justify-center font-bold text-xs">
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

      {/* BOWLER SELECT MODAL WITH OVER QUOTA & CONSECUTIVE OVER RULES */}
      {bowlerSelectOpen && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
           <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
             
             {/* Header */}
             <div className="p-4 text-center border-b border-gray-800 bg-gray-950 relative">
                <div className="flex items-center justify-center gap-1.5 text-tiger-gold text-xs font-black uppercase tracking-wider mb-1">
                   <Target size={14} />
                   <span>Over {matchState.currentOver + (matchState.currentBall === 0 && matchState.ballHistory.length > 0 ? 1 : matchState.currentBall === 0 ? 1 : 0)} Bowler</span>
                </div>
                <h3 className="text-lg font-black text-white uppercase">Select Bowler</h3>
                
                {/* Format Quota & Rules Note */}
                <div className="mt-2 p-2 bg-gray-900 rounded-lg border border-gray-800 text-[10px] text-gray-300 flex flex-col gap-1">
                   <div className="flex justify-between items-center">
                     <span className="text-gray-400">Format Quota:</span>
                     <span className="font-bold text-blue-400">{maxBowlerOvers} overs max per bowler</span>
                   </div>
                   {lastOverBowler && (
                     <div className="flex justify-between items-center text-amber-400/90 border-t border-gray-800/80 pt-1">
                       <span>Previous Over ({matchState.currentOver}):</span>
                       <span className="font-bold">{lastOverBowler.name} (Law 17.8: No consecutive overs)</span>
                     </div>
                   )}
                </div>

                {/* Close Button if Bowler already set or mid-over */}
                <button 
                  onClick={() => setBowlerSelectOpen(false)}
                  className="absolute right-3 top-3 p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors"
                >
                  <X size={18} />
                </button>
             </div>

             {/* Bowlers List */}
             <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                {eligibleBowlersCount === 0 && (
                   <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex items-center gap-2">
                     <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
                     <span>All bowlers have completed their quota or bowled the previous over. Quota rules are relaxed so you can assign any bowler to continue.</span>
                   </div>
                )}
                {matchState.bowlingTeam.players.map(p => {
                  const eligibility = checkBowlerEligibility(
                    p, 
                    matchState.currentBowlerId, 
                    matchState.lastOverBowlerId, 
                    matchState.totalOvers, 
                    matchState.currentBall === 0
                  );

                  const canSelect = eligibility.canBowl || allowEmergencyOverride || eligibleBowlersCount === 0;

                  return (
                    <div
                      key={p.id}
                      className={`w-full p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                        canSelect
                          ? 'bg-gray-800 hover:bg-gray-750 border-gray-700 hover:border-tiger-gold cursor-pointer'
                          : 'bg-gray-900/60 border-gray-800/80 opacity-60'
                      }`}
                      onClick={() => {
                        if (canSelect) {
                          handleChangeBowler(p.id);
                        }
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {p.id === matchState.currentBowlerId && (
                              <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded border border-blue-500/30">Current</span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                            {eligibility.oversBowled} / {maxBowlerOvers} ov • {p.wickets} wkts • {p.runsConceded} runs (Econ {calculateEconomy(p.runsConceded, p.ballsBowled)})
                          </div>
                        </div>

                        {canSelect ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleChangeBowler(p.id);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-tiger-gold text-black text-xs font-black uppercase tracking-wider hover:bg-yellow-400 shadow-md active:scale-95 transition-all"
                          >
                            Select
                          </button>
                        ) : (
                          <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase text-right ${
                            eligibility.reason === 'CONSECUTIVE_OVER'
                              ? 'bg-amber-950/40 text-amber-400 border-amber-800/50'
                              : eligibility.reason === 'QUOTA_EXHAUSTED'
                              ? 'bg-red-950/40 text-red-400 border-red-800/50'
                              : 'bg-gray-800 text-gray-400 border-gray-700'
                          }`}>
                            {eligibility.message || 'Unavailable'}
                          </span>
                        )}
                      </div>

                      {/* Quota Progress Bar */}
                      <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            p.ballsBowled >= maxBowlerOvers * 6 
                              ? 'bg-red-500' 
                              : p.id === matchState.lastOverBowlerId
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(100, (p.ballsBowled / (maxBowlerOvers * 6)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
             </div>

             {/* Emergency Override Option */}
             <div className="p-3 border-t border-gray-800 bg-gray-950 flex items-center justify-between text-[11px] text-gray-400">
               <label className="flex items-center gap-2 cursor-pointer select-none">
                 <input 
                   type="checkbox" 
                   checked={allowEmergencyOverride} 
                   onChange={(e) => setAllowEmergencyOverride(e.target.checked)}
                   className="rounded bg-gray-800 border-gray-700 text-tiger-gold focus:ring-0"
                 />
                 <span>Emergency Rule Override (Allow any bowler)</span>
               </label>
               {matchState.currentBowlerId && (
                 <button
                   onClick={() => setBowlerSelectOpen(false)}
                   className="text-gray-400 hover:text-white font-bold"
                 >
                   Cancel
                 </button>
               )}
             </div>

           </div>
        </div>
      )}

      {/* POWERPLAY & MATCH RULES MODAL */}
      {powerplayModalOpen && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
           <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
              <div className="p-4 border-b border-gray-800 bg-gray-950 flex justify-between items-center">
                 <div className="flex items-center gap-2">
                   <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-400">
                     <Zap size={18} className="fill-amber-400" />
                   </div>
                   <div>
                     <h3 className="text-base font-black text-white uppercase tracking-wider">Powerplay & Format Rules</h3>
                     <p className="text-[10px] text-gray-400">{matchState.totalOvers} Overs Limited Overs Match</p>
                   </div>
                 </div>
                 <button onClick={() => setPowerplayModalOpen(false)} className="p-1 hover:bg-gray-800 rounded-full text-gray-400">
                   <X size={18} />
                 </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto no-scrollbar text-xs">
                 {/* Powerplay Section */}
                 <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-black uppercase text-amber-300 flex items-center gap-1">
                        <Zap size={13} className="fill-amber-300" /> Powerplay Restrictions
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px]">
                        {powerplay.isPowerplay ? 'ACTIVE NOW' : 'NORMAL FIELD'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                        <div className="text-[9px] text-gray-400 uppercase font-bold">Powerplay Duration</div>
                        <div className="text-sm font-black text-white">Overs {powerplay.startOver} – {powerplay.endOver}</div>
                      </div>
                      <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                        <div className="text-[9px] text-gray-400 uppercase font-bold">Fielding Limit</div>
                        <div className="text-sm font-black text-amber-300">Max 2 Fielders</div>
                        <div className="text-[8px] text-gray-400">Outside 30-yard circle</div>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-300 leading-relaxed">
                      During Powerplay, a maximum of 2 fielders can be stationed outside the 30-yard inner circle. After over {powerplay.endOver}, standard fielding limits apply (maximum 5 fielders outside the circle).
                    </p>
                 </div>

                 {/* Bowler Quota Section */}
                 <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2">
                    <span className="font-black uppercase text-blue-300 flex items-center gap-1">
                      <Target size={13} /> Bowler Over Limit
                    </span>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                        <div className="text-[9px] text-gray-400 uppercase font-bold">Maximum Quota</div>
                        <div className="text-sm font-black text-white">{maxBowlerOvers} Overs</div>
                        <div className="text-[8px] text-gray-400">Per bowler in {matchState.totalOvers} ov match</div>
                      </div>
                      <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                        <div className="text-[9px] text-gray-400 uppercase font-bold">Minimum Bowlers</div>
                        <div className="text-sm font-black text-blue-300">5 Bowlers</div>
                        <div className="text-[8px] text-gray-400">Required to complete innings</div>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-300 leading-relaxed">
                      In a {matchState.totalOvers}-over match, no single bowler may bowl more than 20% of the total overs ({maxBowlerOvers} overs). Once a bowler completes their quota, they cannot bowl again in this innings.
                    </p>
                 </div>

                 {/* Law 17.8 Section */}
                 <div className="p-3 bg-gray-800/60 border border-gray-700 rounded-xl space-y-1.5">
                    <span className="font-black uppercase text-gray-200 flex items-center gap-1">
                      <ShieldAlert size={13} className="text-tiger-gold" /> Consecutive Overs Rule (Law 17.8)
                    </span>
                    <p className="text-[10px] text-gray-300 leading-relaxed">
                      A bowler cannot bowl two consecutive overs in the same innings. If a bowler bowled over 5, another bowler must bowl over 6. The original bowler is eligible to return for over 7 as long as they still have overs remaining in their quota.
                    </p>
                 </div>
              </div>

              <div className="p-3 border-t border-gray-800 bg-gray-950 flex justify-end">
                <button
                  onClick={() => setPowerplayModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-tiger-gold text-black font-black uppercase text-xs hover:bg-yellow-400"
                >
                  Close
                </button>
              </div>
           </div>
        </div>
      )}

      {/* FULL SCORECARD MODAL */}
      {scorecardOpen && (
        <ScorecardModal 
          matchState={matchState} 
          onClose={() => setScorecardOpen(false)} 
        />
      )}

      {/* BATSMAN RETIREMENT MODAL */}
      {retireModalOpen && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 text-center">
              <h3 className="text-base font-black uppercase text-amber-400 tracking-wider flex items-center justify-center gap-1.5">
                <UserMinus size={16} /> Retire Batsman
              </h3>
              <p className="text-[11px] text-gray-300 mt-0.5">
                {batsmanToRetire === 'striker' ? striker?.name : nonStriker?.name} ({batsmanToRetire === 'striker' ? 'Striker' : 'Non-Striker'})
              </p>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Select Retirement Reason</div>
              
              <button
                type="button"
                onClick={() => setRetireType(WicketType.RETIRED_HURT)}
                className={`w-full p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  retireType === WicketType.RETIRED_HURT
                    ? 'bg-amber-500/20 border-amber-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750'
                }`}
              >
                <div className="font-bold text-xs text-amber-300">Retired Hurt / Illness (Not Out)</div>
                <div className="text-[10px] text-gray-400 leading-snug">
                  Law 25.4.2: Player retires due to injury or illness. Does NOT count as a wicket. May resume batting later if permitted.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRetireType(WicketType.RETIRED_OUT)}
                className={`w-full p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  retireType === WicketType.RETIRED_OUT
                    ? 'bg-red-500/20 border-red-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750'
                }`}
              >
                <div className="font-bold text-xs text-red-400">Retired Out (Counts as Wicket)</div>
                <div className="text-[10px] text-gray-400 leading-snug">
                  Law 25.4.3: Player retires tactically without umpire injury permission. Counts as a wicket for the bowling team.
                </div>
              </button>
            </div>

            <div className="p-3 bg-gray-950 border-t border-gray-800 flex gap-2">
              <button
                type="button"
                onClick={() => setRetireModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white font-bold text-xs uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRetirement}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider shadow-lg"
              >
                Confirm Retire
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RAIN / DECLARATION / EARLY CONCLUSION MODAL */}
      {declareModalOpen && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Header & Tabs */}
            <div className="p-4 bg-gray-950 border-b border-gray-800 relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                    <CloudRain size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wide">Match Interruption & Declaration</h3>
                    <p className="text-[10px] text-gray-400">Manage declarations, rain stops, or abandonment</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeclareModalOpen(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-800"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-900 rounded-xl border border-gray-800">
                <button
                  type="button"
                  onClick={() => setDeclarationTab('innings')}
                  className={`py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                    declarationTab === 'innings'
                      ? 'bg-tiger-gold text-black shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Flag size={12} className="inline mr-1" /> Declare Innings
                </button>
                <button
                  type="button"
                  onClick={() => setDeclarationTab('rain')}
                  className={`py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                    declarationTab === 'rain'
                      ? 'bg-tiger-gold text-black shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <CloudRain size={12} className="inline mr-1" /> Rain / Conclude
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {declarationTab === 'innings' ? (
                <div className="space-y-3">
                  <div className="p-3 bg-black/40 border border-gray-800 rounded-xl space-y-2">
                    <div className="text-[10px] text-gray-400 uppercase font-bold">Current Inning State</div>
                    <div className="text-xl font-black text-white">
                      {matchState.battingTeam.name}: {matchState.totalRuns}/{matchState.wickets}{' '}
                      <span className="text-sm font-mono text-tiger-gold font-normal">
                        ({matchState.currentOver}.{matchState.currentBall} ov)
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      {matchState.inningsNumber === 1
                        ? `Declaring now will close ${matchState.battingTeam.name}'s first innings. ${matchState.bowlingTeam.name} will begin their 2nd innings chasing ${matchState.totalRuns + 1} runs.`
                        : `Declaring now will conclude the match with ${matchState.battingTeam.name}'s innings closed.`}
                    </p>
                  </div>

                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200">
                    ℹ️ All individual player scores, balls faced, and bowling figures will be preserved accurately in career statistics.
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmDeclaration}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black uppercase text-xs tracking-wider rounded-xl shadow-lg transition-all"
                  >
                    Declare Innings Now ({matchState.totalRuns}/{matchState.wickets} dec)
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Choose Conclusion Scenario</div>
                  
                  <div className="space-y-2">
                    {[
                      {
                        key: 'RAIN_ABANDONED',
                        title: 'Match Abandoned due to Rain (No Result)',
                        desc: 'Play halted by weather or ground conditions. Record saved up to this point as Abandoned.'
                      },
                      {
                        key: 'RAIN_DLS',
                        title: 'Rain Interrupted - DLS / Revised Target Result',
                        desc: 'Match concluded with revised target or DLS formula applied.'
                      },
                      {
                        key: 'MUTUAL_DRAW',
                        title: 'Drawn by Mutual Agreement',
                        desc: 'Both captains agree to call off play and record match as drawn.'
                      },
                      {
                        key: 'CONCEDED',
                        title: 'Match Conceded / Forfeited',
                        desc: 'One team forfeits or concedes the fixture.'
                      }
                    ].map(opt => (
                      <div
                        key={opt.key}
                        onClick={() => setRainReason(opt.key as any)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          rainReason === opt.key
                            ? 'bg-amber-500/15 border-amber-500 text-white'
                            : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-750'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center justify-between">
                          <span>{opt.title}</span>
                          {rainReason === opt.key && <CheckCircle2 size={14} className="text-amber-400" />}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1 leading-relaxed">{opt.desc}</div>
                      </div>
                    ))}
                  </div>

                  {/* DLS / Forfeit winner selector */}
                  {(rainReason === 'RAIN_DLS' || rainReason === 'CONCEDED') && (
                    <div className="p-3 bg-black/40 border border-gray-800 rounded-xl space-y-2">
                      <label className="text-[10px] text-gray-400 uppercase font-bold block">Winning Team</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDlsWinner(matchState.battingTeam.name)}
                          className={`py-2 px-3 rounded-lg border text-xs font-bold truncate ${
                            dlsWinner === matchState.battingTeam.name
                              ? 'bg-tiger-gold text-black border-tiger-gold'
                              : 'bg-gray-800 text-gray-300 border-gray-700'
                          }`}
                        >
                          {matchState.battingTeam.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDlsWinner(matchState.bowlingTeam.name)}
                          className={`py-2 px-3 rounded-lg border text-xs font-bold truncate ${
                            dlsWinner === matchState.bowlingTeam.name
                              ? 'bg-tiger-gold text-black border-tiger-gold'
                              : 'bg-gray-800 text-gray-300 border-gray-700'
                          }`}
                        >
                          {matchState.bowlingTeam.name}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Custom Result Note */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold block">Custom Result / Match Note (Optional)</label>
                    <input
                      type="text"
                      placeholder={`e.g. ${rainReason === 'RAIN_DLS' ? `${dlsWinner} won by 8 runs (DLS)` : 'Abandoned due to heavy rain'}`}
                      value={customResultInput}
                      onChange={(e) => setCustomResultInput(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-tiger-gold font-medium"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmEarlyConclusion}
                    className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-lg transition-all"
                  >
                    Save & Conclude Match Record
                  </button>
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-950 border-t border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={() => setDeclareModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-700 text-gray-400 hover:text-white font-bold text-xs uppercase"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FULL SCORECARD MODAL */}
      {scorecardOpen && (
        <ScorecardModal 
          matchState={matchState} 
          onClose={() => setScorecardOpen(false)} 
        />
      )}

    </div>
  );
};
