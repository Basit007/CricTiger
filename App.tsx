import React, { useState, useEffect } from 'react';
import { MatchSetup } from './components/MatchSetup';
import { SquadSelection } from './components/SquadSelection';
import { TossScreen } from './components/TossScreen';
import { OpenerSelection } from './components/OpenerSelection';
import { ScoringDashboard } from './components/ScoringDashboard';
import { InningsBreak } from './components/InningsBreak';
import { StatsDashboard } from './components/StatsDashboard';
import { TeamManager } from './components/TeamManager';
import { AuthScreen } from './components/AuthScreen';
import { MatchState, Team, SavedTeam, TeamAccount } from './types';
import { MatchSummary } from './components/MatchSummary';
import { 
  getSavedMatches, 
  saveMatch, 
  getCurrentTeamAccount, 
  logoutTeamAccount, 
  getDraftMatch, 
  saveDraftMatch, 
  clearDraftMatch,
  purgeOldLegacyData 
} from './utils/storage';

interface SetupData {
  homeTeam: SavedTeam;
  awayTeam: SavedTeam;
  overs: number;
  homeXI?: string[]; 
  awayXI?: string[];
  homeReserves?: string[]; 
  awayReserves?: string[];
}

const App: React.FC = () => {
  const [currentAccount, setCurrentAccount] = useState<TeamAccount | null>(null);
  const [view, setView] = useState<'setup' | 'team-manager' | 'squad-select' | 'toss' | 'openers' | 'scoring' | 'innings-break' | 'summary' | 'stats'>('setup');
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchState[]>([]);
  const [history, setHistory] = useState<MatchState[]>([]);
  const [hasDraft, setHasDraft] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and load active account
  useEffect(() => {
    purgeOldLegacyData();
    const account = getCurrentTeamAccount();
    if (account) {
      setCurrentAccount(account);
      const matches = getSavedMatches(account.id);
      setMatchHistory(matches);
      const draft = getDraftMatch(account.id);
      if (draft) setHasDraft(true);
    }
    setIsLoading(false);
  }, []);

  // Whenever account changes, re-fetch their isolated matches and draft
  useEffect(() => {
    if (currentAccount) {
      const matches = getSavedMatches(currentAccount.id);
      setMatchHistory(matches);
      const draft = getDraftMatch(currentAccount.id);
      setHasDraft(!!draft);
    } else {
      setMatchHistory([]);
      setHasDraft(false);
    }
  }, [currentAccount]);

  // Auto-save draft scoped to current team account
  useEffect(() => {
    if (isLoading || !currentAccount) return;
    if (matchState && view !== 'setup') {
      saveDraftMatch({ matchState, view, setupData }, currentAccount.id);
      setHasDraft(true);
    }
  }, [matchState, view, setupData, currentAccount, isLoading]);

  const handleLoginSuccess = (account: TeamAccount) => {
    setCurrentAccount(account);
    const matches = getSavedMatches(account.id);
    setMatchHistory(matches);
    const draft = getDraftMatch(account.id);
    setHasDraft(!!draft);
    setView('setup');
  };

  const handleLogout = () => {
    logoutTeamAccount();
    setCurrentAccount(null);
    setMatchState(null);
    setSetupData(null);
    setHistory([]);
    setView('setup');
  };

  const handleContinueDraft = () => {
    if (!currentAccount) return;
    const draft = getDraftMatch(currentAccount.id);
    if (draft) {
      try {
        setMatchState(draft.matchState);
        setView(draft.view as any);
        if (draft.setupData) setSetupData(draft.setupData);
      } catch (e) {
        console.error('Failed to parse draft', e);
      }
    }
  };

  // 1. Initial Setup
  const handleSetupComplete = (
    homeTeam: SavedTeam,
    awayTeam: SavedTeam,
    overs: number
  ) => {
    setSetupData({ homeTeam, awayTeam, overs });
    setView('squad-select');
  };

  // 2. Select 11 Players + Reserves
  const handleSquadConfirm = (homeXI: string[], awayXI: string[], homeReserves: string[], awayReserves: string[]) => {
    setSetupData(prev => prev ? ({ ...prev, homeXI, awayXI, homeReserves, awayReserves }) : null);
    setView('toss');
  };

  // 3. Toss Logic
  const handleTossComplete = (winner: string, decision: 'bat' | 'bowl') => {
    if (!setupData || !setupData.homeXI || !setupData.awayXI) return;

    const isHomeBattingFirst = (winner === setupData.homeTeam.name && decision === 'bat') || (winner === setupData.awayTeam.name && decision === 'bowl');

    const battingTeamPlayers = isHomeBattingFirst ? setupData.homeXI : setupData.awayXI;
    const bowlingTeamPlayers = isHomeBattingFirst ? setupData.awayXI : setupData.homeXI;
    const battingTeamObj = isHomeBattingFirst ? setupData.homeTeam : setupData.awayTeam;
    const bowlingTeamObj = isHomeBattingFirst ? setupData.awayTeam : setupData.homeTeam;

    const battingTeam: Team = {
      name: battingTeamObj.name,
      logoUrl: battingTeamObj.logoUrl,
      players: battingTeamPlayers.map((name, id) => ({ id: `bat${id}`, name, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0 })),
      isBatting: true,
    };

    const bowlingTeam: Team = {
      name: bowlingTeamObj.name,
      logoUrl: bowlingTeamObj.logoUrl,
      players: bowlingTeamPlayers.map((name, id) => ({ id: `bowl${id}`, name, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0 })),
      isBatting: false,
    };

    const initialState: MatchState = {
      battingTeam,
      bowlingTeam,
      tossWinner: winner,
      tossDecision: decision,
      totalOvers: setupData.overs,
      currentOver: 0,
      currentBall: 0,
      totalRuns: 0,
      wickets: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      strikerId: '', 
      nonStrikerId: '', 
      currentBowlerId: '', 
      ballHistory: [],
      matchStatus: 'LIVE',
      inningsNumber: 1
    };

    setMatchState(initialState);
    setView('openers');
  };

  // 4. Start Innings
  const handleStartInnings = (strikerId: string, nonStrikerId: string, bowlerId: string) => {
    if (!matchState) return;
    setMatchState({
      ...matchState,
      strikerId,
      nonStrikerId,
      currentBowlerId: bowlerId,
      matchStatus: 'LIVE'
    });
    setView('scoring');
  };

  // 5. Innings/Match Flow
  const handleScoringFinish = () => {
    if (!matchState) return;
    if (matchState.matchStatus === 'INNINGS_BREAK') {
      setView('innings-break');
    } else if (matchState.matchStatus === 'COMPLETED') {
      setView('summary');
    }
  };

  // 6. Start 2nd Innings
  const handleStartSecondInnings = () => {
    if (!matchState) return;

    const oldBatting = matchState.battingTeam;
    const oldBowling = matchState.bowlingTeam;
    
    // Swap Roles
    const newBattingTeam: Team = { ...oldBowling, isBatting: true };
    const newBowlingTeam: Team = { ...oldBatting, isBatting: false };

    const newState: MatchState = {
      ...matchState,
      battingTeam: newBattingTeam,
      bowlingTeam: newBowlingTeam,
      totalRuns: 0,
      wickets: 0,
      currentOver: 0,
      currentBall: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      strikerId: '',
      nonStrikerId: '',
      currentBowlerId: '',
      inningsNumber: 2,
      target: matchState.totalRuns + 1,
      matchStatus: 'LIVE'
    };

    setMatchState(newState);
    setHistory([]);
    setView('openers');
  };

  const handleUpdateScore = (newState: MatchState) => {
    if (matchState) setHistory(prev => [...prev, matchState].slice(-50));
    setMatchState(newState);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setMatchState(previousState);
  };

  const handleSaveAndExit = (finalState: MatchState) => {
    if (currentAccount) {
      saveMatch(finalState, currentAccount.id);
      clearDraftMatch(currentAccount.id);
    }
    setMatchHistory(prev => [...prev, finalState]);
    setHasDraft(false);
    setView('setup');
    setMatchState(null);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-tiger-black flex items-center justify-center text-tiger-gold font-bold">
        Loading CricTiger...
      </div>
    );
  }

  // Not logged in -> Show Authentication Screen
  if (!currentAccount) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="h-[100dvh] w-full bg-tiger-black text-white flex flex-col font-sans overflow-hidden">
      {view === 'setup' && (
        <MatchSetup 
          currentAccount={currentAccount}
          onNext={handleSetupComplete} 
          onViewStats={() => setView('stats')}
          onManageTeams={() => setView('team-manager')}
          onContinue={hasDraft ? handleContinueDraft : undefined}
          onLogout={handleLogout}
          hasDraft={hasDraft}
        />
      )}
      
      {view === 'team-manager' && (
        <TeamManager 
          currentAccount={currentAccount}
          onBack={() => setView('setup')} 
        />
      )}

      {view === 'squad-select' && setupData && (
        <SquadSelection
           homeTeam={setupData.homeTeam}
           awayTeam={setupData.awayTeam}
           onConfirm={handleSquadConfirm}
           onBack={() => setView('setup')}
        />
      )}

      {view === 'toss' && setupData && (
        <TossScreen 
          homeTeam={setupData.homeTeam.name} 
          awayTeam={setupData.awayTeam.name} 
          onTossComplete={handleTossComplete}
          onBack={() => setView('setup')}
        />
      )}

      {view === 'openers' && matchState && (
        <OpenerSelection
          inningsNumber={matchState.inningsNumber}
          battingTeamName={matchState.battingTeam.name}
          bowlingTeamName={matchState.bowlingTeam.name}
          battingPlayers={matchState.battingTeam.players}
          bowlingPlayers={matchState.bowlingTeam.players}
          onStart={handleStartInnings}
        />
      )}

      {view === 'scoring' && matchState && (
        <ScoringDashboard 
          matchState={matchState} 
          setMatchState={handleUpdateScore} 
          onUndo={handleUndo}
          canUndo={history.length > 0}
          onFinish={handleScoringFinish}
        />
      )}

      {view === 'innings-break' && matchState && (
        <InningsBreak 
          matchState={matchState}
          onStartSecondInnings={handleStartSecondInnings}
        />
      )}

      {view === 'summary' && matchState && (
        <MatchSummary 
          matchState={matchState} 
          onSaveAndExit={handleSaveAndExit} 
        />
      )}

      {view === 'stats' && (
        <StatsDashboard 
          matchHistory={matchHistory} 
          currentTeamName={currentAccount.teamName}
          onBack={() => setView('setup')} 
        />
      )}
    </div>
  );
};

export default App;
