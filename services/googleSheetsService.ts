import { MatchState } from '../types';
import { aggregateStats, aggregateTeamStats, CareerStats, TeamSummaryStats } from '../utils/statsLogic';
import { getDeveloperDbConfig, saveDeveloperDbConfig, DeveloperDbConfig } from '../utils/storage';

export const APPS_SCRIPT_TEMPLATE = `/**
 * CricTiger Google Sheets Database Engine
 * Instructions:
 * 1. In your Google Sheet, click Extensions > Apps Script
 * 2. Replace all existing text with this code
 * 3. Click Deploy > New deployment
 * 4. Choose type: 'Web app'
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web app URL and paste it into CricTiger Developer Settings
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. SYNC PLAYER STATS
    if (data.players && data.players.length > 0) {
      var pSheet = ss.getSheetByName("Player_Stats");
      if (!pSheet) {
        pSheet = ss.insertSheet("Player_Stats");
        pSheet.appendRow([
          "Player Name", "Team", "Matches", "Runs", "Balls", "4s", "6s", 
          "Highest Score", "Average", "Strike Rate", "Wickets", "Overs", 
          "Runs Conceded", "Economy", "Best Bowling", "Last Synced"
        ]);
        pSheet.getRange(1, 1, 1, 16).setBackground("#0F172A").setFontColor("#FBBF24").setFontWeight("bold");
        pSheet.setFrozenRows(1);
      }
      
      var lastRow = pSheet.getLastRow();
      if (lastRow > 1) {
        pSheet.getRange(2, 1, lastRow - 1, 16).clearContent();
      }

      var pRows = data.players.map(function(p) {
        var overs = Math.floor(p.ballsBowled / 6) + "." + (p.ballsBowled % 6);
        var bbi = p.bestBowling && p.bestBowling.wickets > 0 ? p.bestBowling.wickets + "/" + p.bestBowling.runs : "-";
        return [
          p.name, 
          p.team || data.teamName || "Club", 
          p.matches, 
          p.runs, 
          p.ballsFaced, 
          p.fours || 0, 
          p.sixes || 0,
          p.highestScore, 
          p.average, 
          p.strikeRate, 
          p.wickets, 
          overs,
          p.runsConceded, 
          p.economy, 
          bbi, 
          new Date().toLocaleString()
        ];
      });

      if (pRows.length > 0) {
        pSheet.getRange(2, 1, pRows.length, 16).setValues(pRows);
      }
    }

    // 2. SYNC MATCHES LOG
    if (data.matches && data.matches.length > 0) {
      var mSheet = ss.getSheetByName("Matches");
      if (!mSheet) {
        mSheet = ss.insertSheet("Matches");
        mSheet.appendRow([
          "Match Date", "Team 1 (1st Inn)", "Score 1", "Team 2 (2nd Inn)", 
          "Score 2", "Result / Notes", "Overs Format", "Toss Winner", "Toss Decision", "Synced At"
        ]);
        mSheet.getRange(1, 1, 1, 10).setBackground("#0F172A").setFontColor("#38BDF8").setFontWeight("bold");
        mSheet.setFrozenRows(1);
      }

      var mLastRow = mSheet.getLastRow();
      if (mLastRow > 1) {
        mSheet.getRange(2, 1, mLastRow - 1, 10).clearContent();
      }

      var mRows = data.matches.map(function(m) {
        return [
          m.date, 
          m.team1, 
          m.score1, 
          m.team2, 
          m.score2, 
          m.result, 
          m.totalOvers + " ov", 
          m.tossWinner, 
          m.tossDecision,
          new Date().toLocaleString()
        ];
      });

      if (mRows.length > 0) {
        mSheet.getRange(2, 1, mRows.length, 10).setValues(mRows);
      }
    }

    // 3. SYNC TEAM SUMMARY
    if (data.teamSummary) {
      var tSheet = ss.getSheetByName("Team_Summary");
      if (!tSheet) {
        tSheet = ss.insertSheet("Team_Summary");
        tSheet.appendRow(["Record Metric", "Club Value"]);
        tSheet.getRange(1, 1, 1, 2).setBackground("#0F172A").setFontColor("#34D399").setFontWeight("bold");
        tSheet.setFrozenRows(1);
      }

      var tLastRow = tSheet.getLastRow();
      if (tLastRow > 1) {
        tSheet.getRange(2, 1, tLastRow - 1, 2).clearContent();
      }

      var s = data.teamSummary;
      var sRows = [
        ["Club / Team Name", data.teamName || "Club"],
        ["Total Matches Played", s.totalMatches],
        ["Matches Won", s.won],
        ["Matches Defeated", s.lost],
        ["Matches Tied", s.tied],
        ["Win Percentage", s.winRate + "%"],
        ["Highest Team Total", s.highestTotal ? s.highestTotal.runs + "/" + s.highestTotal.wickets + " (" + s.highestTotal.overs + " ov) vs " + s.highestTotal.against : "-"],
        ["Lowest Team Total", s.lowestTotal && s.lowestTotal.runs < 9999 ? s.lowestTotal.runs + "/" + s.lowestTotal.wickets + " (" + s.lowestTotal.overs + " ov) vs " + s.lowestTotal.against : "-"],
        ["All-Time Run Scorer", s.topRunScorer ? s.topRunScorer.name + " (" + s.topRunScorer.runs + " runs)" : "-"],
        ["All-Time Wicket Taker", s.topWicketTaker ? s.topWicketTaker.name + " (" + s.topWicketTaker.wickets + " wickets)" : "-"],
        ["Last Synchronized", new Date().toLocaleString()]
      ];

      tSheet.getRange(2, 1, sRows.length, 2).setValues(sRows);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Synced " + (data.players ? data.players.length : 0) + " players and " + (data.matches ? data.matches.length : 0) + " matches.",
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    app: "CricTiger",
    service: "Google Sheets Database Connector",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}`;

export interface FormattedMatchSyncItem {
  date: string;
  team1: string;
  score1: string;
  team2: string;
  score2: string;
  result: string;
  totalOvers: number;
  tossWinner: string;
  tossDecision: string;
}

export const formatMatchesForSync = (history: MatchState[]): FormattedMatchSyncItem[] => {
  return history.map(m => {
    const date = new Date(m.ballHistory[0]?.timestamp || Date.now()).toLocaleDateString();
    const team1Name = m.firstInningsScore?.teamName || m.bowlingTeam.name;
    const team1Score = m.firstInningsScore 
      ? `${m.firstInningsScore.runs}/${m.firstInningsScore.wickets} (${m.firstInningsScore.overs})`
      : `${m.totalRuns}/${m.wickets}`;
    const team2Name = m.battingTeam.name;
    const team2Score = `${m.totalRuns}/${m.wickets} (${m.currentOver}.${m.currentBall})`;
    const result = m.customResult || m.declarationNote || 'Completed';

    return {
      date,
      team1: team1Name,
      score1: team1Score,
      team2: team2Name,
      score2: team2Score,
      result,
      totalOvers: m.totalOvers,
      tossWinner: m.tossWinner || '',
      tossDecision: m.tossDecision || ''
    };
  });
};

/**
 * Sync all matches and aggregate career stats directly to Google Sheets database via server proxy
 */
export const syncAllToGoogleSheets = async (
  history: MatchState[],
  teamName: string,
  webhookOverride?: string
): Promise<{ success: boolean; message: string }> => {
  const config = getDeveloperDbConfig();
  const webhookUrl = webhookOverride || config.sheetWebhookUrl;

  if (!webhookUrl || !webhookUrl.trim()) {
    return {
      success: false,
      message: 'No Google Sheet Webhook URL configured. Please set it in Developer Database Settings.'
    };
  }

  try {
    const players = aggregateStats(history, teamName);
    const teamSummary = aggregateTeamStats(history, teamName);
    const formattedMatches = formatMatchesForSync(history);

    const payload = {
      teamName,
      players,
      matches: formattedMatches,
      teamSummary,
      syncedAt: new Date().toISOString()
    };

    const res = await fetch('/api/sheets/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: webhookUrl.trim(), payload })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Server proxy failed to reach Google Sheet.');
    }

    // Update config with last sync time
    config.lastSyncTimestamp = Date.now();
    config.lastSyncStatus = 'SUCCESS';
    saveDeveloperDbConfig(config);

    return {
      success: true,
      message: data.result?.message || 'Database synchronized with Google Sheet successfully!'
    };
  } catch (err: any) {
    console.error('Failed to sync to Google Sheets:', err);
    config.lastSyncStatus = 'FAILED';
    saveDeveloperDbConfig(config);
    return {
      success: false,
      message: err.message || 'Connection to Google Sheet timed out or failed.'
    };
  }
};

/**
 * Ping the Google Sheet Webhook to test reachability
 */
export const testGoogleSheetWebhook = async (webhookUrl: string): Promise<{ success: boolean; message: string }> => {
  if (!webhookUrl || !webhookUrl.trim()) {
    return { success: false, message: 'Please enter a Google Sheets Webhook URL.' };
  }

  try {
    const res = await fetch('/api/sheets/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: webhookUrl.trim() })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Webhook test failed.');
    }

    return {
      success: true,
      message: 'Google Sheet Webhook is active and responding!'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Could not connect to Google Sheet Webhook.'
    };
  }
};
