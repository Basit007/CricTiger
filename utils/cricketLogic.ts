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
    // International Rule: On a Free Hit, only Run Out is possible (simplified)
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
        // Clear the ID if no replacement provided immediately
        if (wicketDetails.isStrikerOut) {
          newState.strikerId = '';
        } else {
          newState.nonStrikerId = '';
        }
      }
    } else {
      // Wicket hit on Free Hit but not allowed
      // (Optional: add note to commentary)
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
  }

  // 6. Match Status Logic (End of Innings/Match)
  
  // Check if All Out or Overs Done
  const isAllOut = newState.wickets >= 10; // Standard cricket. Setup might allow less but assuming 10.
  const isOversDone = newState.currentOver >= newState.totalOvers;
  
  // Check 2nd Innings Win
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
       // Match end, target not reached
       newState.matchStatus = 'COMPLETED';
    }
  }

  return newState;
};