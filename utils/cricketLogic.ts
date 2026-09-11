import { MatchState, BallEvent, ExtraType, WicketType, Player, WicketDetails } from '../types';

export const getPlayer = (players: Player[], id: string) => players.find(p => p.id === id);

export const calculateEconomy = (runs: number, balls: number) => {
  if (balls === 0) return 0;
  return ((runs / balls) * 6).toFixed(2);
};

export const calculateStrikeRate = (runs: number, balls: number) => {
  if (balls === 0) return 0;
  return ((runs / balls) * 100).toFixed(2);
};

/**
 * Maximum overs a single bowler can bowl in limited overs cricket
 * Formula: ceil(totalOvers / 5), minimum 1
 * E.g., 20 overs -> 4 overs; 50 overs -> 10 overs; 10 overs -> 2 overs; 5 overs -> 1 over
 */
export const getMaxBowlerOvers = (totalOvers: number): number => {
  if (!totalOvers || totalOvers <= 0) return 4;
  return Math.max(1, Math.ceil(totalOvers / 5));
};

/**
 * Returns number of mandatory powerplay overs based on match length
 */
export const getPowerplayOvers = (totalOvers: number): number => {
  if (totalOvers >= 50) return 10;
  if (totalOvers >= 20) return 6;
  if (totalOvers >= 10) return 3;
  if (totalOvers >= 5) return 2;
  return 1;
};

export interface PowerplayStatus {
  isPowerplay: boolean;
  phaseName: string;
  currentOverNumber: number;
  totalPowerplayOvers: number;
  startOver: number;
  endOver: number;
  fieldingRestriction: string;
  oversRemaining: number;
}

export const getPowerplayStatus = (currentOver: number, currentBall: number, totalOvers: number): PowerplayStatus => {
  const overNum = currentOver + 1; // 1-indexed (1 to totalOvers)

  if (totalOvers >= 50) {
    if (overNum <= 10) {
      return {
        isPowerplay: true,
        phaseName: 'Powerplay 1 (Mandatory)',
        currentOverNumber: overNum,
        totalPowerplayOvers: 10,
        startOver: 1,
        endOver: 10,
        fieldingRestriction: 'Max 2 fielders outside 30-yard circle',
        oversRemaining: Math.max(0, 10 - currentOver)
      };
    } else if (overNum <= 40) {
      return {
        isPowerplay: true,
        phaseName: 'Powerplay 2 (Middle Overs)',
        currentOverNumber: overNum,
        totalPowerplayOvers: 30,
        startOver: 11,
        endOver: 40,
        fieldingRestriction: 'Max 4 fielders outside 30-yard circle',
        oversRemaining: Math.max(0, 40 - currentOver)
      };
    } else {
      return {
        isPowerplay: true,
        phaseName: 'Powerplay 3 (Death Overs)',
        currentOverNumber: overNum,
        totalPowerplayOvers: 10,
        startOver: 41,
        endOver: 50,
        fieldingRestriction: 'Max 5 fielders outside 30-yard circle',
        oversRemaining: Math.max(0, 50 - currentOver)
      };
    }
  }

  const ppOvers = getPowerplayOvers(totalOvers);
  const isPP = overNum <= ppOvers && currentOver < totalOvers;

  return {
    isPowerplay: isPP,
    phaseName: isPP ? `Powerplay (Overs 1-${ppOvers})` : 'Normal Field',
    currentOverNumber: overNum,
    totalPowerplayOvers: ppOvers,
    startOver: 1,
    endOver: ppOvers,
    fieldingRestriction: isPP ? 'Max 2 fielders outside 30-yard circle' : 'Max 5 fielders outside 30-yard circle',
    oversRemaining: isPP ? Math.max(0, ppOvers - currentOver) : 0
  };
};

export interface BowlerEligibility {
  canBowl: boolean;
  reason?: 'CONSECUTIVE_OVER' | 'QUOTA_EXHAUSTED' | 'CURRENT_BOWLER';
  message?: string;
  oversBowled: string;
  ballsBowled: number;
  maxOvers: number;
  oversRemaining: number;
}

export const checkBowlerEligibility = (
  player: Player,
  currentBowlerId: string,
  lastOverBowlerId: string | undefined,
  totalOvers: number,
  isStartOfOver: boolean = true
): BowlerEligibility => {
  const maxOvers = getMaxBowlerOvers(totalOvers);
  const fullOvers = Math.floor(player.ballsBowled / 6);
  const partialBalls = player.ballsBowled % 6;
  const oversBowledStr = `${fullOvers}.${partialBalls}`;
  const oversRemaining = Math.max(0, maxOvers - Math.ceil(player.ballsBowled / 6));

  // 1. Quota check: if player has bowled maxOvers full overs (or ballsBowled >= maxOvers * 6)
  if (player.ballsBowled >= maxOvers * 6) {
    return {
      canBowl: false,
      reason: 'QUOTA_EXHAUSTED',
      message: `Quota completed (${maxOvers}/${maxOvers} ov)`,
      oversBowled: oversBowledStr,
      ballsBowled: player.ballsBowled,
      maxOvers,
      oversRemaining: 0
    };
  }

  // 2. Consecutive over check: cannot bowl consecutive overs
  if (lastOverBowlerId && player.id === lastOverBowlerId) {
    return {
      canBowl: false,
      reason: 'CONSECUTIVE_OVER',
      message: 'Cannot bowl consecutive overs',
      oversBowled: oversBowledStr,
      ballsBowled: player.ballsBowled,
      maxOvers,
      oversRemaining
    };
  }

  // 3. Mid-over change check
  if (!isStartOfOver && currentBowlerId && player.id === currentBowlerId) {
    return {
      canBowl: false,
      reason: 'CURRENT_BOWLER',
      message: 'Currently bowling',
      oversBowled: oversBowledStr,
      ballsBowled: player.ballsBowled,
      maxOvers,
      oversRemaining
    };
  }

  return {
    canBowl: true,
    oversBowled: oversBowledStr,
    ballsBowled: player.ballsBowled,
    maxOvers,
    oversRemaining
  };
};

export const getInningsPowerplayScore = (
  ballHistory: BallEvent[],
  inningsNumber: 1 | 2,
  powerplayOvers: number
): { runs: number; wickets: number; balls: number } => {
  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;

  for (const ball of ballHistory) {
    if (ball.inningsNumber !== inningsNumber) continue;
    if (legalBalls >= powerplayOvers * 6) break;

    runs += ball.runs + ball.extraRuns;
    if (ball.isWicket) wickets++;
    if (ball.isLegalBall) {
      legalBalls++;
    }
  }

  return { runs, wickets, balls: legalBalls };
};

/**
 * Main pure function to update state based on a scoring event
 */
export const processBall = (
  currentState: MatchState,
  runs: number,
  extraType: ExtraType,
  isWicket: boolean,
  wicketDetails: WicketDetails | undefined,
  newBatsmanId?: string
): MatchState => {
  const newState = JSON.parse(JSON.stringify(currentState)) as MatchState;
  
  const striker = getPlayer(newState.battingTeam.players, newState.strikerId)!;
  const nonStriker = getPlayer(newState.battingTeam.players, newState.nonStrikerId)!;
  const bowler = getPlayer(newState.bowlingTeam.players, newState.currentBowlerId)!;

  let runsScored = runs; 
  let extrasConceded = 0;
  let isLegalBall = true;
  const isCurrentlyFreeHit = currentState.isFreeHit || false;

  // 1. Handle Extras logic
  if (extraType === ExtraType.WIDE) {
    extrasConceded += 1 + runs; 
    newState.extras.wides += 1 + runs;
    isLegalBall = false;
    bowler.runsConceded += 1 + runs;
    runsScored = 0; 
  } else if (extraType === ExtraType.NO_BALL) {
    extrasConceded += 1;
    newState.extras.noBalls += 1;
    isLegalBall = false;
    bowler.runsConceded += 1;
    newState.isFreeHit = true; // Next ball is free hit
    
    striker.runs += runs;
    if (runs === 4) striker.fours++;
    if (runs === 6) striker.sixes++;
    
    bowler.runsConceded += runs;
    runsScored = runs; 
  } else if (extraType === ExtraType.BYE) {
    extrasConceded += runs;
    newState.extras.byes += runs;
    striker.balls++; 
    isLegalBall = true;
    runsScored = 0; 
    if (isCurrentlyFreeHit) newState.isFreeHit = false;
  } else if (extraType === ExtraType.LEG_BYE) {
    extrasConceded += runs;
    newState.extras.legByes += runs;
    striker.balls++; 
    isLegalBall = true;
    runsScored = 0; 
    if (isCurrentlyFreeHit) newState.isFreeHit = false;
  } else {
    // Regular ball
    striker.runs += runs;
    striker.balls++;
    if (runs === 4) striker.fours++;
    if (runs === 6) striker.sixes++;
    
    bowler.runsConceded += runs;
    runsScored = runs; 
    if (isCurrentlyFreeHit) newState.isFreeHit = false;
  }

  // Update Bowler Stats (Legal balls only)
  if (isLegalBall) {
    bowler.ballsBowled++;
    newState.currentBall++;
  }

  // Total Score Update
  newState.totalRuns += runsScored + extrasConceded;

  // 2. Handle Wicket
  if (isWicket && wicketDetails) {
    // International Rule: On a Free Hit, only Run Out is possible
    const canBeOut = !isCurrentlyFreeHit || wicketDetails.type === WicketType.RUN_OUT;

    if (canBeOut) {
      newState.wickets++;
      
      // Determine who is out
      const victim = wicketDetails.isStrikerOut ? striker : nonStriker;

      if (wicketDetails.type !== WicketType.RUN_OUT) {
        bowler.wickets++;
      }
      
      victim.isOut = true;
      victim.dismissalType = wicketDetails.type;
      victim.dismissalBowler = bowler.name;
      if (wicketDetails.fielderName) {
        victim.dismissalFielder = wicketDetails.fielderName;
      }

      if (newBatsmanId) {
        if (wicketDetails.isStrikerOut) {
          newState.strikerId = newBatsmanId;
        } else {
          newState.nonStrikerId = newBatsmanId;
        }
      } else {
        if (wicketDetails.isStrikerOut) {
          newState.strikerId = '';
        } else {
          newState.nonStrikerId = '';
        }
      }
    }
  }

  // 3. Strike Rotation
  if (runs % 2 !== 0) {
    const temp = newState.strikerId;
    newState.strikerId = newState.nonStrikerId;
    newState.nonStrikerId = temp;
  }

  // 4. Record Event
  let description = `${runs} run${runs !== 1 ? 's' : ''}`;
  if (extraType !== ExtraType.NONE) description += ` (${extraType})`;
  if (isWicket && wicketDetails) {
    description += ` WICKET (${wicketDetails.type})`;
    if (wicketDetails.fielderName) description += ` by ${wicketDetails.fielderName}`;
  }

  const event: BallEvent = {
    runs,
    extraRuns: extrasConceded,
    extraType,
    isWicket,
    wicketType: wicketDetails?.type,
    batsmanId: striker.id,
    bowlerId: bowler.id,
    description,
    timestamp: Date.now(),
    isLegalBall,
    inningsNumber: newState.inningsNumber
  };
  newState.ballHistory.push(event);

  // 5. Over Completion
  if (newState.currentBall >= 6) {
    newState.currentOver++;
    newState.currentBall = 0;
    const temp = newState.strikerId;
    newState.strikerId = newState.nonStrikerId;
    newState.nonStrikerId = temp;

    // Check maiden over for bowler in this over
    // If bowler conceded 0 runs in this over
    const ballsThisInnings = newState.ballHistory.filter(
      b => b.inningsNumber === newState.inningsNumber && b.bowlerId === bowler.id
    );
    // Look at the events of this over (the last 6+ deliveries bowled by this bowler)
    let overRunsConceded = 0;
    let legalBallsInOver = 0;
    for (let i = ballsThisInnings.length - 1; i >= 0; i--) {
      const b = ballsThisInnings[i];
      // Bowler runs conceded = runs off bat + wide/no-ball runs
      if (b.extraType === ExtraType.WIDE || b.extraType === ExtraType.NO_BALL) {
        overRunsConceded += b.extraRuns;
      } else {
        overRunsConceded += b.runs;
      }
      if (b.isLegalBall) legalBallsInOver++;
      if (legalBallsInOver === 6) break;
    }
    if (legalBallsInOver === 6 && overRunsConceded === 0) {
      bowler.maidens++;
    }

    // Set last over bowler for consecutive over enforcement
    newState.lastOverBowlerId = bowler.id;
    // Clear current bowler so next bowler must be selected for the new over
    newState.currentBowlerId = '';
  }

  // 6. Match Status Logic (End of Innings/Match)
  const isAllOut = newState.wickets >= 10;
  const isOversDone = newState.currentOver >= newState.totalOvers;
  const isTargetChased = newState.inningsNumber === 2 && newState.target && newState.totalRuns >= newState.target;

  if (newState.inningsNumber === 1) {
    if (isAllOut || isOversDone) {
      newState.matchStatus = 'INNINGS_BREAK';
      newState.firstInningsScore = {
        runs: newState.totalRuns,
        wickets: newState.wickets,
        overs: `${newState.currentOver}.${newState.currentBall}`,
        teamName: newState.battingTeam.name
      };
    }
  } else {
    // Innings 2
    if (isTargetChased) {
      newState.matchStatus = 'COMPLETED';
    } else if (isAllOut || isOversDone) {
       newState.matchStatus = 'COMPLETED';
    }
  }

  return newState;
};

/**
 * Retires or declares a batsman (Retired Hurt / Retired Out)
 */
export const retireBatsman = (
  currentState: MatchState,
  batsmanId: string,
  type: WicketType.RETIRED_HURT | WicketType.RETIRED_OUT,
  newBatsmanId?: string
): MatchState => {
  const newState = JSON.parse(JSON.stringify(currentState)) as MatchState;
  const batter = getPlayer(newState.battingTeam.players, batsmanId);
  if (!batter) return newState;

  const isStriker = newState.strikerId === batsmanId;
  const isRetiredOut = type === WicketType.RETIRED_OUT;

  if (isRetiredOut) {
    batter.isOut = true;
    batter.dismissalType = 'Retired Out';
    newState.wickets++;
  } else {
    // Retired Hurt / Not Out
    batter.isOut = false;
    batter.dismissalType = 'Retired Hurt (Not Out)';
  }

  if (newBatsmanId) {
    if (isStriker) {
      newState.strikerId = newBatsmanId;
    } else {
      newState.nonStrikerId = newBatsmanId;
    }
  } else {
    if (isStriker) {
      newState.strikerId = '';
    } else {
      newState.nonStrikerId = '';
    }
  }

  const desc = `${batter.name} ${isRetiredOut ? 'Retired Out' : 'Retired Hurt'} (${batter.runs} runs off ${batter.balls} balls)`;

  newState.ballHistory.push({
    runs: 0,
    extraRuns: 0,
    extraType: ExtraType.NONE,
    isWicket: isRetiredOut,
    wicketType: type,
    batsmanId,
    bowlerId: newState.currentBowlerId || '',
    description: desc,
    timestamp: Date.now(),
    isLegalBall: false,
    inningsNumber: newState.inningsNumber
  });

  return newState;
};

/**
 * Declare innings early (Batting captain declaration)
 */
export const declareInnings = (
  currentState: MatchState,
  note: string = 'Innings Declared'
): MatchState => {
  const newState = JSON.parse(JSON.stringify(currentState)) as MatchState;
  newState.isDeclaredInnings = true;
  newState.declarationNote = note;

  newState.ballHistory.push({
    runs: 0,
    extraRuns: 0,
    extraType: ExtraType.NONE,
    isWicket: false,
    batsmanId: newState.strikerId,
    bowlerId: newState.currentBowlerId || '',
    description: `INNINGS DECLARED at ${newState.totalRuns}/${newState.wickets} (${newState.currentOver}.${newState.currentBall} ov)`,
    timestamp: Date.now(),
    isLegalBall: false,
    inningsNumber: newState.inningsNumber,
    isDeclaration: true
  });

  if (newState.inningsNumber === 1) {
    newState.matchStatus = 'INNINGS_BREAK';
    newState.firstInningsScore = {
      runs: newState.totalRuns,
      wickets: newState.wickets,
      overs: `${newState.currentOver}.${newState.currentBall} (dec)`,
      teamName: newState.battingTeam.name
    };
  } else {
    newState.matchStatus = 'COMPLETED';
    const target = newState.target || 0;
    if (newState.totalRuns >= target) {
      newState.customResult = `${newState.battingTeam.name} won by ${10 - newState.wickets} wickets (Declared)`;
    } else {
      const diff = (target - 1) - newState.totalRuns;
      newState.customResult = `${newState.firstInningsScore?.teamName || newState.bowlingTeam.name} won by ${diff} runs (Innings Declared)`;
    }
  }

  return newState;
};

/**
 * Conclude or abandon match at any point due to rain, weather, DLS, or mutual consent
 */
export const concludeMatchEarly = (
  currentState: MatchState,
  reason: 'RAIN_ABANDONED' | 'RAIN_DLS' | 'MUTUAL_DRAW' | 'CONCEDED' | 'CUSTOM',
  customResultText?: string,
  winnerTeamName?: string
): MatchState => {
  const newState = JSON.parse(JSON.stringify(currentState)) as MatchState;
  newState.matchStatus = 'COMPLETED';

  let resultSummary = '';
  if (reason === 'RAIN_ABANDONED') {
    resultSummary = `Match Abandoned due to Rain (${newState.totalRuns}/${newState.wickets} in ${newState.currentOver}.${newState.currentBall} ov)`;
  } else if (reason === 'RAIN_DLS') {
    resultSummary = customResultText || (winnerTeamName ? `${winnerTeamName} won via DLS Method (Rain Interruption)` : `Result by DLS Method (Rain)`);
  } else if (reason === 'MUTUAL_DRAW') {
    resultSummary = customResultText || 'Match Drawn by Mutual Agreement';
  } else if (reason === 'CONCEDED') {
    resultSummary = customResultText || (winnerTeamName ? `${winnerTeamName} won by Forfeit / Conceded` : 'Match Conceded');
  } else {
    resultSummary = customResultText || 'Match Concluded Early';
  }

  newState.declarationNote = resultSummary;
  newState.customResult = resultSummary;

  if (newState.inningsNumber === 1 && !newState.firstInningsScore) {
    newState.firstInningsScore = {
      runs: newState.totalRuns,
      wickets: newState.wickets,
      overs: `${newState.currentOver}.${newState.currentBall}`,
      teamName: newState.battingTeam.name
    };
  }

  newState.ballHistory.push({
    runs: 0,
    extraRuns: 0,
    extraType: ExtraType.NONE,
    isWicket: false,
    batsmanId: newState.strikerId,
    bowlerId: newState.currentBowlerId || '',
    description: `MATCH CONCLUDED: ${resultSummary}`,
    timestamp: Date.now(),
    isLegalBall: false,
    inningsNumber: newState.inningsNumber,
    isDeclaration: true
  });

  return newState;
};

export const getEligibleBowlersCount = (
  players: Player[],
  currentBowlerId: string,
  lastOverBowlerId: string | undefined,
  totalOvers: number,
  isStartOfOver: boolean = true
): number => {
  return players.filter(p => checkBowlerEligibility(p, currentBowlerId, lastOverBowlerId, totalOvers, isStartOfOver).canBowl).length;
};
