export interface Player {
  id: string;
  name: string;
  // Batting stats
  runs: number;
  balls: number; // Balls faced
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalType?: string;
  dismissalBowler?: string;
  dismissalFielder?: string; // Name of fielder who caught/run-out
  // Bowling stats
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
}

export interface Team {
  name: string;
  players: Player[]; // This refers to the Playing XI
  isBatting: boolean;
  logoUrl?: string; // Added logo support
}

export interface SavedTeam {
  id: string;
  name: string;
  logoUrl?: string;
  squad: string[]; // Unlimited squad list
}

export interface TeamAccount {
  id: string;
  teamName: string;
  username: string;
  passwordHash: string;
  logoUrl?: string;
  city?: string;
  managerName?: string;
  createdAt: number;
}

export interface Extras {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
}

export enum ExtraType {
  NONE = 'None',
  WIDE = 'Wide',
  NO_BALL = 'No Ball',
  BYE = 'Bye',
  LEG_BYE = 'Leg Bye',
}

export enum WicketType {
  BOWLED = 'Bowled',
  CAUGHT = 'Caught',
  LBW = 'LBW',
  RUN_OUT = 'Run Out',
  STUMPED = 'Stumped',
  HIT_WICKET = 'Hit Wicket',
  RETIRED_HURT = 'Retired Hurt',
  RETIRED_OUT = 'Retired Out',
}

export interface BallEvent {
  runs: number; // Runs off bat
  extraRuns: number; // Runs from extras
  extraType: ExtraType;
  isWicket: boolean;
  wicketType?: WicketType;
  batsmanId: string;
  bowlerId: string;
  description: string;
  timestamp: number;
  isLegalBall: boolean;
  inningsNumber: 1 | 2;
  isDeclaration?: boolean;
}

export interface WicketDetails {
  type: WicketType;
  fielderName?: string;
  isStrikerOut: boolean;
}

export interface MatchState {
  battingTeam: Team;
  bowlingTeam: Team;
  tossWinner: string;
  tossDecision: 'bat' | 'bowl';
  totalOvers: number;
  currentOver: number;
  currentBall: number; // Legal balls in current over (0-5)
  totalRuns: number;
  wickets: number;
  extras: Extras;
  strikerId: string;
  nonStrikerId: string;
  currentBowlerId: string;
  lastOverBowlerId?: string; // Bowler who completed previous over (cannot bowl consecutive overs)
  ballHistory: BallEvent[];
  matchStatus: 'LIVE' | 'INNINGS_BREAK' | 'COMPLETED';
  isFreeHit?: boolean;
  
  // New fields for 2 innings support
  inningsNumber: 1 | 2;
  target?: number; // Only for 2nd innings
  firstInningsScore?: {
    runs: number;
    wickets: number;
    overs: string;
    teamName: string;
  };
  // Declaration & Weather/Rain fields
  declarationNote?: string;
  customResult?: string;
  isDeclaredInnings?: boolean;
}