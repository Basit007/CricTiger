import { MatchState, Player } from '../types';

export interface CareerStats {
  name: string;
  team: string;
  matches: number;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  highestScore: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  maidens: number;
  bestBowling: { wickets: number; runs: number };
  outs: number;
  strikeRate: number;
  average: number;
  economy: number;
}

export interface TeamSummaryStats {
  totalMatches: number;
  won: number;
  lost: number;
  tied: number;
  abandoned: number;
  winRate: number;
  highestTotal: { runs: number; wickets: number; overs: string; against: string };
  lowestTotal: { runs: number; wickets: number; overs: string; against: string };
  topRunScorer: { name: string; runs: number; matches: number };
  topWicketTaker: { name: string; wickets: number; matches: number };
}

export const aggregateStats = (history: MatchState[], teamFilter?: string): CareerStats[] => {
  const statsMap = new Map<string, {
    name: string;
    team: string;
    matches: number;
    runs: number;
    ballsFaced: number;
    fours: number;
    sixes: number;
    highestScore: number;
    wickets: number;
    ballsBowled: number;
    runsConceded: number;
    maidens: number;
    bestBowling: { wickets: number; runs: number };
    outs: number;
  }>();

  const updatePlayerStats = (p: Player, teamName: string) => {
    if (!p.name) return;
    const nameKey = p.name.trim();

    if (!statsMap.has(nameKey)) {
      statsMap.set(nameKey, {
        name: nameKey,
        team: teamName,
        matches: 0,
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        highestScore: 0,
        wickets: 0,
        ballsBowled: 0,
        runsConceded: 0,
        maidens: 0,
        bestBowling: { wickets: 0, runs: 999 },
        outs: 0
      });
    }

    const stats = statsMap.get(nameKey)!;
    stats.matches += 1;
    stats.runs += p.runs || 0;
    stats.ballsFaced += p.balls || 0;
    stats.fours += p.fours || 0;
    stats.sixes += p.sixes || 0;
    if ((p.runs || 0) > stats.highestScore) {
      stats.highestScore = p.runs || 0;
    }
    if (p.isOut) {
      stats.outs += 1;
    }

    stats.wickets += p.wickets || 0;
    stats.ballsBowled += p.ballsBowled || 0;
    stats.runsConceded += p.runsConceded || 0;
    stats.maidens += p.maidens || 0;

    const wkts = p.wickets || 0;
    const runsConc = p.runsConceded || 0;
    if (wkts > stats.bestBowling.wickets || (wkts === stats.bestBowling.wickets && runsConc < stats.bestBowling.runs && wkts > 0)) {
      stats.bestBowling = { wickets: wkts, runs: runsConc };
    }
  };

  history.forEach(match => {
    const isHomeFilter = !teamFilter || teamFilter === 'ALL' || match.battingTeam.name === teamFilter;
    const isAwayFilter = !teamFilter || teamFilter === 'ALL' || match.bowlingTeam.name === teamFilter;

    if (isHomeFilter) {
      match.battingTeam.players.forEach(p => updatePlayerStats(p, match.battingTeam.name));
    }
    if (isAwayFilter) {
      match.bowlingTeam.players.forEach(p => updatePlayerStats(p, match.bowlingTeam.name));
    }
  });

  return Array.from(statsMap.values()).map(s => {
    const sr = s.ballsFaced > 0 ? (s.runs / s.ballsFaced) * 100 : 0;
    const avg = s.outs > 0 ? s.runs / s.outs : s.runs;
    const econ = s.ballsBowled > 0 ? (s.runsConceded / s.ballsBowled) * 6 : 0;
    return {
      ...s,
      strikeRate: parseFloat(sr.toFixed(1)),
      average: parseFloat(avg.toFixed(1)),
      economy: parseFloat(econ.toFixed(2))
    };
  });
};

export const aggregateTeamStats = (history: MatchState[], teamName: string): TeamSummaryStats => {
  let won = 0;
  let lost = 0;
  let tied = 0;
  let abandoned = 0;
  let highestTotal = { runs: 0, wickets: 0, overs: '0.0', against: 'None' };
  let lowestTotal = { runs: 9999, wickets: 10, overs: '0.0', against: 'None' };

  history.forEach(m => {
    if (m.battingTeam.name !== teamName && m.bowlingTeam.name !== teamName) return;

    // Check innings score for this team
    let teamRuns = 0;
    let teamWickets = 0;
    let teamOvers = '0.0';
    let opponentName = '';

    if (m.battingTeam.name === teamName) {
      teamRuns = m.totalRuns;
      teamWickets = m.wickets;
      teamOvers = `${m.currentOver}.${m.currentBall}`;
      opponentName = m.bowlingTeam.name;
    } else if (m.firstInningsScore && m.firstInningsScore.teamName === teamName) {
      teamRuns = m.firstInningsScore.runs;
      teamWickets = m.firstInningsScore.wickets;
      teamOvers = m.firstInningsScore.overs;
      opponentName = m.battingTeam.name;
    }

    if (teamRuns > highestTotal.runs) {
      highestTotal = { runs: teamRuns, wickets: teamWickets, overs: teamOvers, against: opponentName };
    }
    if (teamRuns < lowestTotal.runs && teamRuns > 0) {
      lowestTotal = { runs: teamRuns, wickets: teamWickets, overs: teamOvers, against: opponentName };
    }

    if (m.declarationNote && (m.declarationNote.includes('Abandoned') || m.declarationNote.includes('Drawn'))) {
      abandoned++;
    } else if (m.firstInningsScore) {
      const inn1 = m.firstInningsScore.runs;
      const inn2 = m.totalRuns;
      const inn1Team = m.firstInningsScore.teamName;
      const inn2Team = m.battingTeam.name;

      if (inn2 > inn1) {
        if (inn2Team === teamName) won++;
        else lost++;
      } else if (inn1 > inn2) {
        if (inn1Team === teamName) won++;
        else lost++;
      } else {
        tied++;
      }
    }
  });

  const totalMatches = won + lost + tied + abandoned;
  const winRate = totalMatches > 0 ? Math.round((won / (won + lost || 1)) * 100) : 0;

  const playerStats = aggregateStats(history, teamName);
  const sortedBatters = [...playerStats].sort((a, b) => b.runs - a.runs);
  const sortedBowlers = [...playerStats].sort((a, b) => b.wickets - a.wickets);

  return {
    totalMatches,
    won,
    lost,
    tied,
    abandoned,
    winRate,
    highestTotal: highestTotal.runs > 0 ? highestTotal : { runs: 0, wickets: 0, overs: '0.0', against: 'N/A' },
    lowestTotal: lowestTotal.runs < 9999 ? lowestTotal : { runs: 0, wickets: 0, overs: '0.0', against: 'N/A' },
    topRunScorer: sortedBatters[0] ? { name: sortedBatters[0].name, runs: sortedBatters[0].runs, matches: sortedBatters[0].matches } : { name: 'N/A', runs: 0, matches: 0 },
    topWicketTaker: sortedBowlers[0] ? { name: sortedBowlers[0].name, wickets: sortedBowlers[0].wickets, matches: sortedBowlers[0].matches } : { name: 'N/A', wickets: 0, matches: 0 }
  };
};

/**
 * Generate standard CSV formatted for Google Sheets import
 */
export const generateCareerCSV = (stats: CareerStats[], teamName: string): string => {
  const headers = [
    'Player Name',
    'Team',
    'Matches',
    'Runs',
    'Balls Faced',
    'Fours (4s)',
    'Sixes (6s)',
    'Highest Score',
    'Batting Average',
    'Strike Rate',
    'Wickets',
    'Overs Bowled',
    'Runs Conceded',
    'Economy',
    'Best Bowling (BBI)'
  ];

  const rows = stats.map(p => {
    const overs = `${Math.floor(p.ballsBowled / 6)}.${p.ballsBowled % 6}`;
    const bbi = p.bestBowling.wickets > 0 ? `${p.bestBowling.wickets}/${p.bestBowling.runs}` : '-';
    return [
      `"${p.name}"`,
      `"${p.team || teamName}"`,
      p.matches,
      p.runs,
      p.ballsFaced,
      p.fours,
      p.sixes,
      p.highestScore,
      p.average,
      p.strikeRate,
      p.wickets,
      `"${overs}"`,
      p.runsConceded,
      p.economy,
      `"${bbi}"`
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};

/**
 * Generate TSV (Tab Separated) for instant copy-paste into Google Sheets
 */
export const generateCareerTSV = (stats: CareerStats[], teamName: string): string => {
  const headers = [
    'Player Name',
    'Team',
    'Matches',
    'Runs',
    'Balls Faced',
    '4s',
    '6s',
    'Highest Score',
    'Average',
    'Strike Rate',
    'Wickets',
    'Overs',
    'Runs Conceded',
    'Economy',
    'Best Bowling'
  ];

  const rows = stats.map(p => {
    const overs = `${Math.floor(p.ballsBowled / 6)}.${p.ballsBowled % 6}`;
    const bbi = p.bestBowling.wickets > 0 ? `${p.bestBowling.wickets}/${p.bestBowling.runs}` : '-';
    return [
      p.name,
      p.team || teamName,
      p.matches,
      p.runs,
      p.ballsFaced,
      p.fours,
      p.sixes,
      p.highestScore,
      p.average,
      p.strikeRate,
      p.wickets,
      overs,
      p.runsConceded,
      p.economy,
      bbi
    ].join('\t');
  });

  return [headers.join('\t'), ...rows].join('\n');
};

/**
 * Generate matches history CSV for Google Sheets
 */
export const generateMatchesCSV = (history: MatchState[], teamName: string): string => {
  const headers = [
    'Match Date',
    'Team 1 (Bat 1st)',
    'Team 1 Score',
    'Team 2 (Bat 2nd)',
    'Team 2 Score',
    'Toss Winner',
    'Toss Decision',
    'Result / Declaration Note'
  ];

  const rows = history.map(m => {
    const date = new Date(m.ballHistory[0]?.timestamp || Date.now()).toLocaleDateString();
    const team1Name = m.firstInningsScore?.teamName || m.bowlingTeam.name;
    const team1Score = m.firstInningsScore ? `${m.firstInningsScore.runs}/${m.firstInningsScore.wickets} (${m.firstInningsScore.overs})` : `${m.totalRuns}/${m.wickets}`;
    const team2Name = m.battingTeam.name;
    const team2Score = `${m.totalRuns}/${m.wickets} (${m.currentOver}.${m.currentBall})`;
    const result = m.customResult || m.declarationNote || 'Completed';

    return [
      `"${date}"`,
      `"${team1Name}"`,
      `"${team1Score}"`,
      `"${team2Name}"`,
      `"${team2Score}"`,
      `"${m.tossWinner}"`,
      `"${m.tossDecision}"`,
      `"${result}"`
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};