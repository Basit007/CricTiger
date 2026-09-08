import { MatchState, Player } from '../types';

export interface CareerStats {
  name: string;
  matches: number;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  highestScore: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  bestBowling: { wickets: number; runs: number };
  outs: number;
}

export const aggregateStats = (history: MatchState[], teamFilter: string = 'Taxila Tigers'): CareerStats[] => {
  const statsMap = new Map<string, CareerStats>();

  const updatePlayerStats = (p: Player) => {
    if (!p.name) return;
    
    // Normalize name to handle slight variations or case
    const nameKey = p.name.trim();

    if (!statsMap.has(nameKey)) {
      statsMap.set(nameKey, {
        name: nameKey,
        matches: 0,
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        highestScore: 0,
        wickets: 0,
        ballsBowled: 0,
        runsConceded: 0,
        bestBowling: { wickets: 0, runs: 999 },
        outs: 0
      });
    }

    const stats = statsMap.get(nameKey)!;
    stats.matches += 1;
    
    // Batting Updates
    stats.runs += p.runs;
    stats.ballsFaced += p.balls;
    stats.fours += p.fours;
    stats.sixes += p.sixes;
    if (p.runs > stats.highestScore) {
      stats.highestScore = p.runs;
    }
    if (p.isOut) {
      stats.outs += 1;
    }

    // Bowling Updates
    stats.wickets += p.wickets;
    stats.ballsBowled += p.ballsBowled;
    stats.runsConceded += p.runsConceded;

    // Update Best Bowling figures (More wickets is better, then fewer runs)
    if (p.wickets > stats.bestBowling.wickets || 
       (p.wickets === stats.bestBowling.wickets && p.runsConceded < stats.bestBowling.runs && p.wickets > 0)) {
      stats.bestBowling = { wickets: p.wickets, runs: p.runsConceded };
    }
  };

  history.forEach(match => {
    // Only process players if they belong to the filtered team (e.g., Taxila Tigers)
    if (match.battingTeam.name === teamFilter) {
      match.battingTeam.players.forEach(updatePlayerStats);
    }
    
    if (match.bowlingTeam.name === teamFilter) {
      match.bowlingTeam.players.forEach(updatePlayerStats);
    }
  });

  return Array.from(statsMap.values());
};