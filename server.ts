import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Modality } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Ensure data persistence directory exists safely
let DATA_DIR = path.join(process.cwd(), "data");
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch {
  DATA_DIR = path.join("/tmp", "crictiger_data");
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const RECORDS_FILE = path.join(DATA_DIR, "team_records.json");
const DEV_CONFIG_FILE = path.join(DATA_DIR, "dev_config.json");

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Deterministic client-compatible hash
const hashPassword = (pw: string): string => {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    hash = (hash << 5) - hash + pw.charCodeAt(i);
    hash |= 0;
  }
  return "ct_" + Math.abs(hash).toString(16) + "_" + pw.length;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- CROSS-DEVICE TEAM ACCOUNT & DATA APIS ---

  // Get all registered accounts (public metadata)
  app.get("/api/accounts", (req, res) => {
    const accounts = readJsonFile<any[]>(ACCOUNTS_FILE, []);
    res.json({ success: true, accounts });
  });

  // Sync / upload local accounts from any device into server database
  app.post("/api/accounts/sync-local", (req, res) => {
    try {
      const { accounts: incoming = [] } = req.body;
      const current = readJsonFile<any[]>(ACCOUNTS_FILE, []);
      let changed = false;

      for (const inc of incoming) {
        if (!inc || !inc.username) continue;
        const exists = current.some(
          (a) => a.id === inc.id || a.username.toLowerCase() === inc.username.toLowerCase()
        );
        if (!exists) {
          current.push(inc);
          changed = true;
        }
      }

      if (changed) {
        writeJsonFile(ACCOUNTS_FILE, current);
      }

      res.json({ success: true, accounts: current });
    } catch (err: any) {
      console.error("Failed to sync local accounts:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Register team account on the server
  app.post("/api/accounts/register", (req, res) => {
    try {
      const { teamName, username, password, city, managerName, logoUrl, initialSquad } = req.body;
      const trimmedUser = (username || "").trim().toLowerCase();
      const trimmedTeam = (teamName || "").trim();

      if (!trimmedUser || trimmedUser.length < 3) {
        return res.status(400).json({ success: false, error: "Username must be at least 3 characters." });
      }
      if (!trimmedTeam) {
        return res.status(400).json({ success: false, error: "Team name is required." });
      }
      if (!password || password.length < 4) {
        return res.status(400).json({ success: false, error: "Password must be at least 4 characters." });
      }

      const accounts = readJsonFile<any[]>(ACCOUNTS_FILE, []);
      if (accounts.some((a) => a.username.toLowerCase() === trimmedUser)) {
        return res.status(400).json({
          success: false,
          error: "A team with this username already exists. Please choose another username.",
        });
      }

      const accountId = "acc_" + Date.now().toString() + "_" + Math.random().toString(36).substring(2, 7);
      const newAccount = {
        id: accountId,
        teamName: trimmedTeam,
        username: trimmedUser,
        passwordHash: hashPassword(password),
        city: city?.trim() || undefined,
        managerName: managerName?.trim() || undefined,
        logoUrl: logoUrl || undefined,
        createdAt: Date.now(),
      };

      accounts.push(newAccount);
      writeJsonFile(ACCOUNTS_FILE, accounts);

      // Create primary squad in server team records
      const records = readJsonFile<Record<string, { matches: any[]; teams: any[] }>>(RECORDS_FILE, {});
      const primaryTeam = {
        id: `team_${accountId}_primary`,
        name: trimmedTeam,
        logoUrl: logoUrl || undefined,
        squad:
          initialSquad && initialSquad.length >= 11
            ? initialSquad
            : Array.from({ length: 15 }, (_, i) => `${trimmedTeam} Player ${i + 1}`),
      };
      records[accountId] = {
        matches: [],
        teams: [primaryTeam],
      };
      writeJsonFile(RECORDS_FILE, records);

      res.json({
        success: true,
        account: newAccount,
        matches: [],
        teams: [primaryTeam],
      });
    } catch (err: any) {
      console.error("Register account error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to register team account" });
    }
  });

  // Login team account from any device
  app.post("/api/accounts/login", (req, res) => {
    try {
      const { username, password } = req.body;
      const trimmedUser = (username || "").trim().toLowerCase();

      if (!trimmedUser || !password) {
        return res.status(400).json({ success: false, error: "Username and password are required." });
      }

      const accounts = readJsonFile<any[]>(ACCOUNTS_FILE, []);
      const account = accounts.find((a) => a.username.toLowerCase() === trimmedUser);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: "Account not found with this username. Please check your spelling or register a new team.",
        });
      }

      if (account.passwordHash !== hashPassword(password)) {
        return res.status(401).json({ success: false, error: "Incorrect password. Please try again." });
      }

      // Load team matches and squads
      const records = readJsonFile<Record<string, { matches: any[]; teams: any[] }>>(RECORDS_FILE, {});
      const teamData = records[account.id] || { matches: [], teams: [] };

      res.json({
        success: true,
        account,
        matches: teamData.matches || [],
        teams: teamData.teams || [],
      });
    } catch (err: any) {
      console.error("Login account error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to log in" });
    }
  });

  // Reset team password with Admin PIN
  app.post("/api/accounts/reset-password", (req, res) => {
    try {
      const { username, adminPin, newPassword } = req.body;
      const trimmedUser = (username || "").trim().toLowerCase();

      if (!trimmedUser) {
        return res.status(400).json({ success: false, error: "Please enter your team username." });
      }

      const devConfig = readJsonFile<{ adminPin?: string }>(DEV_CONFIG_FILE, { adminPin: "1234" });
      const validPin = devConfig.adminPin || "1234";

      if (!adminPin || adminPin.trim() !== validPin) {
        return res.status(400).json({
          success: false,
          error: "Incorrect Developer / Admin PIN. (Default is 1234 unless customized).",
        });
      }

      if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({
          success: false,
          error: "New password must be at least 4 characters long.",
        });
      }

      const accounts = readJsonFile<any[]>(ACCOUNTS_FILE, []);
      const accountIndex = accounts.findIndex((a) => a.username.toLowerCase() === trimmedUser);

      if (accountIndex === -1) {
        return res.status(404).json({
          success: false,
          error: `No registered team found with username "${username}".`,
        });
      }

      accounts[accountIndex].passwordHash = hashPassword(newPassword);
      writeJsonFile(ACCOUNTS_FILE, accounts);

      res.json({ success: true, message: "Password reset successfully!" });
    } catch (err: any) {
      console.error("Reset password error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to reset password" });
    }
  });

  // Fetch team matches and squads
  app.get("/api/accounts/:accountId/data", (req, res) => {
    const { accountId } = req.params;
    const records = readJsonFile<Record<string, { matches: any[]; teams: any[] }>>(RECORDS_FILE, {});
    const data = records[accountId] || { matches: [], teams: [] };
    res.json({ success: true, data });
  });

  // Save/sync team matches and squads to server
  app.post("/api/accounts/:accountId/data", (req, res) => {
    try {
      const { accountId } = req.params;
      const { matches, teams } = req.body;
      const records = readJsonFile<Record<string, { matches: any[]; teams: any[] }>>(RECORDS_FILE, {});

      if (!records[accountId]) {
        records[accountId] = { matches: [], teams: [] };
      }
      if (Array.isArray(matches)) {
        records[accountId].matches = matches;
      }
      if (Array.isArray(teams)) {
        records[accountId].teams = teams;
      }

      writeJsonFile(RECORDS_FILE, records);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Save account data error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Developer database config sharing across devices
  app.get("/api/dev/config", (req, res) => {
    const devConfig = readJsonFile(DEV_CONFIG_FILE, {
      sheetWebhookUrl: "",
      autoSyncOnMatchEnd: true,
      adminPin: "1234",
      lastSyncStatus: "IDLE",
    });
    res.json({ success: true, config: devConfig });
  });

  app.post("/api/dev/config", (req, res) => {
    try {
      const config = req.body;
      writeJsonFile(DEV_CONFIG_FILE, config);
      res.json({ success: true, config });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- DEVELOPER & OWNER CLOUD DATABASE OPERATIONS ---

  // Database Overview & Stats
  app.get("/api/admin/overview", (req, res) => {
    try {
      const accounts = readJsonFile<any[]>(ACCOUNTS_FILE, []);
      const records = readJsonFile<Record<string, { matches: any[]; teams: any[] }>>(RECORDS_FILE, {});
      const devConfig = readJsonFile(DEV_CONFIG_FILE, { adminPin: "1234" });

      let totalMatches = 0;
      let totalTeams = 0;
      let totalPlayers = 0;

      Object.values(records).forEach((rec) => {
        totalMatches += (rec.matches || []).length;
        totalTeams += (rec.teams || []).length;
        (rec.teams || []).forEach((t) => {
          totalPlayers += (t.squad || []).length;
        });
      });

      const accountsStat = fs.existsSync(ACCOUNTS_FILE) ? fs.statSync(ACCOUNTS_FILE) : null;
      const recordsStat = fs.existsSync(RECORDS_FILE) ? fs.statSync(RECORDS_FILE) : null;

      res.json({
        success: true,
        database: {
          status: "CONNECTED & ONLINE",
          storageLocation: DATA_DIR,
          accountsFile: ACCOUNTS_FILE,
          recordsFile: RECORDS_FILE,
          accountsSizeKb: accountsStat ? (accountsStat.size / 1024).toFixed(2) : "0",
          recordsSizeKb: recordsStat ? (recordsStat.size / 1024).toFixed(2) : "0",
          serverUptimeSeconds: Math.floor(process.uptime()),
          serverTime: new Date().toISOString(),
          environment: process.env.NODE_ENV || "development",
        },
        counts: {
          totalAccounts: accounts.length,
          totalMatches,
          totalTeams,
          totalPlayers,
        },
        accounts: accounts.map((a) => ({
          id: a.id,
          teamName: a.teamName,
          username: a.username,
          city: a.city || "—",
          managerName: a.managerName || "—",
          createdAt: a.createdAt,
          matchesCount: (records[a.id]?.matches || []).length,
          teamsCount: (records[a.id]?.teams || []).length,
        })),
        adminPinConfigured: !!devConfig.adminPin,
      });
    } catch (err: any) {
      console.error("Admin overview error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Full Database JSON Backup
  app.get("/api/admin/backup", (req, res) => {
    try {
      const accounts = readJsonFile<any[]>(ACCOUNTS_FILE, []);
      const records = readJsonFile<Record<string, any>>(RECORDS_FILE, {});
      const devConfig = readJsonFile(DEV_CONFIG_FILE, {});

      const backup = {
        app: "CricTiger Pro Scoring Cloud",
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        databasePath: DATA_DIR,
        accounts,
        records,
        devConfig,
      };

      if (req.query.download === "true" || req.query.download === "1") {
        const dateStr = new Date().toISOString().slice(0, 10);
        res.setHeader("Content-Disposition", `attachment; filename="crictiger_cloud_database_${dateStr}.json"`);
        res.setHeader("Content-Type", "application/json");
      }

      res.json(backup);
    } catch (err: any) {
      console.error("Admin backup error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Restore Database from JSON
  app.post("/api/admin/restore", (req, res) => {
    try {
      const { backup, adminPin } = req.body;
      const devConfig = readJsonFile<{ adminPin?: string }>(DEV_CONFIG_FILE, { adminPin: "1234" });
      const validPin = devConfig.adminPin || "1234";

      if (!adminPin || adminPin.trim() !== validPin) {
        return res.status(403).json({ success: false, error: "Invalid Developer PIN." });
      }

      if (!backup || typeof backup !== "object") {
        return res.status(400).json({ success: false, error: "Invalid backup file payload." });
      }

      if (Array.isArray(backup.accounts)) {
        writeJsonFile(ACCOUNTS_FILE, backup.accounts);
      }
      if (backup.records && typeof backup.records === "object") {
        writeJsonFile(RECORDS_FILE, backup.records);
      }
      if (backup.devConfig && typeof backup.devConfig === "object") {
        writeJsonFile(DEV_CONFIG_FILE, backup.devConfig);
      }

      res.json({ success: true, message: "Cloud database restored successfully!" });
    } catch (err: any) {
      console.error("Admin restore error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin Reset Any Team Password
  app.post("/api/admin/accounts/reset-password", (req, res) => {
    try {
      const { accountId, newPassword, adminPin } = req.body;
      const devConfig = readJsonFile<{ adminPin?: string }>(DEV_CONFIG_FILE, { adminPin: "1234" });
      const validPin = devConfig.adminPin || "1234";

      if (!adminPin || adminPin.trim() !== validPin) {
        return res.status(403).json({ success: false, error: "Invalid Developer PIN." });
      }

      if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ success: false, error: "Password must be at least 4 characters long." });
      }

      const accounts = readJsonFile<any[]>(ACCOUNTS_FILE, []);
      const idx = accounts.findIndex((a) => a.id === accountId || a.username.toLowerCase() === (accountId || "").toLowerCase());

      if (idx === -1) {
        return res.status(404).json({ success: false, error: "Team account not found." });
      }

      accounts[idx].passwordHash = hashPassword(newPassword);
      writeJsonFile(ACCOUNTS_FILE, accounts);

      res.json({ success: true, message: `Password for ${accounts[idx].teamName} updated successfully!` });
    } catch (err: any) {
      console.error("Admin reset password error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin Delete Account
  app.delete("/api/admin/accounts/:accountId", (req, res) => {
    try {
      const { accountId } = req.params;
      const adminPin = req.headers["x-admin-pin"] as string;
      const devConfig = readJsonFile<{ adminPin?: string }>(DEV_CONFIG_FILE, { adminPin: "1234" });
      const validPin = devConfig.adminPin || "1234";

      if (!adminPin || adminPin.trim() !== validPin) {
        return res.status(403).json({ success: false, error: "Invalid Developer PIN." });
      }

      let accounts = readJsonFile<any[]>(ACCOUNTS_FILE, []);
      const target = accounts.find((a) => a.id === accountId);
      if (!target) {
        return res.status(404).json({ success: false, error: "Account not found." });
      }

      accounts = accounts.filter((a) => a.id !== accountId);
      writeJsonFile(ACCOUNTS_FILE, accounts);

      const records = readJsonFile<Record<string, any>>(RECORDS_FILE, {});
      if (records[accountId]) {
        delete records[accountId];
        writeJsonFile(RECORDS_FILE, records);
      }

      res.json({ success: true, message: `Deleted ${target.teamName} and related records.` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Direct CSV Export for Google Sheets & Excel
  app.get("/api/admin/export/csv", (req, res) => {
    try {
      const type = (req.query.type as string) || "accounts";
      const dateStr = new Date().toISOString().slice(0, 10);
      const accounts = readJsonFile<any[]>(ACCOUNTS_FILE, []);
      const records = readJsonFile<Record<string, { matches: any[]; teams: any[] }>>(RECORDS_FILE, {});

      const esc = (val: any) => {
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      };

      if (type === "accounts") {
        const headers = ["Account ID", "Team Name", "Username", "City", "Manager Name", "Registered Date", "Matches Recorded", "Squads Configured"];
        const rows = accounts.map((a) => [
          esc(a.id),
          esc(a.teamName),
          esc(a.username),
          esc(a.city || ""),
          esc(a.managerName || ""),
          esc(a.createdAt ? new Date(a.createdAt).toISOString() : ""),
          esc((records[a.id]?.matches || []).length),
          esc((records[a.id]?.teams || []).length),
        ]);
        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

        res.setHeader("Content-Disposition", `attachment; filename="crictiger_accounts_${dateStr}.csv"`);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.send(csvContent);
      }

      if (type === "matches") {
        const headers = ["Match ID", "Date", "Team Account", "Home Team", "Away Team", "Overs", "Toss Winner", "Toss Decision", "1st Innings Runs", "1st Innings Wkts", "2nd Innings Runs", "2nd Innings Wkts", "Winner", "Margin", "Result Summary"];
        const rows: string[][] = [];

        Object.entries(records).forEach(([accId, rec]) => {
          const acc = accounts.find((a) => a.id === accId);
          (rec.matches || []).forEach((m: any) => {
            const innings1 = m.innings?.[0];
            const innings2 = m.innings?.[1];
            rows.push([
              esc(m.id || ""),
              esc(m.date ? new Date(m.date).toLocaleDateString() : ""),
              esc(acc?.teamName || accId),
              esc(m.homeTeam?.name || m.team1?.name || ""),
              esc(m.awayTeam?.name || m.team2?.name || ""),
              esc(m.totalOvers || m.overs || 20),
              esc(m.toss?.winner || ""),
              esc(m.toss?.decision || ""),
              esc(innings1?.totalRuns ?? ""),
              esc(innings1?.wickets ?? ""),
              esc(innings2?.totalRuns ?? ""),
              esc(innings2?.wickets ?? ""),
              esc(m.result?.winner || ""),
              esc(m.result?.margin || ""),
              esc(m.result?.description || m.result?.summary || ""),
            ]);
          });
        });

        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
        res.setHeader("Content-Disposition", `attachment; filename="crictiger_all_matches_${dateStr}.csv"`);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.send(csvContent);
      }

      if (type === "squads") {
        const headers = ["Club/Account", "Team Name", "Player Number", "Player Name"];
        const rows: string[][] = [];

        Object.entries(records).forEach(([accId, rec]) => {
          const acc = accounts.find((a) => a.id === accId);
          (rec.teams || []).forEach((t: any) => {
            (t.squad || []).forEach((player: string, idx: number) => {
              rows.push([
                esc(acc?.teamName || accId),
                esc(t.name || ""),
                esc(idx + 1),
                esc(player),
              ]);
            });
          });
        });

        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
        res.setHeader("Content-Disposition", `attachment; filename="crictiger_squads_roster_${dateStr}.csv"`);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.send(csvContent);
      }

      res.status(400).json({ success: false, error: "Invalid export type. Use accounts, matches, or squads." });
    } catch (err: any) {
      console.error("CSV export error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Google Sheets Database Sync Proxy
  app.post("/api/sheets/sync", async (req, res) => {
    try {
      const { webhookUrl, payload } = req.body;
      const targetUrl = webhookUrl || process.env.GOOGLE_SHEET_WEBHOOK_URL;
      if (!targetUrl) {
        return res.status(400).json({ success: false, error: "No Google Sheet Webhook URL provided." });
      }

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "follow",
      });

      const text = await response.text();
      let jsonResult;
      try {
        jsonResult = JSON.parse(text);
      } catch {
        jsonResult = { message: text.slice(0, 200) };
      }

      res.json({ success: true, result: jsonResult });
    } catch (err: any) {
      console.error("Google Sheets sync error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to sync to Google Sheet" });
    }
  });

  // Google Sheets Test Proxy
  app.post("/api/sheets/test", async (req, res) => {
    try {
      const { webhookUrl } = req.body;
      const targetUrl = webhookUrl || process.env.GOOGLE_SHEET_WEBHOOK_URL;
      if (!targetUrl) {
        return res.status(400).json({ success: false, error: "No Google Sheet Webhook URL provided." });
      }

      const response = await fetch(targetUrl, {
        method: "GET",
        redirect: "follow",
      });

      const text = await response.text();
      res.json({ success: true, message: "Webhook is reachable!", preview: text.slice(0, 150) });
    } catch (err: any) {
      console.error("Google Sheets test error:", err);
      res.status(500).json({ success: false, error: err.message || "Webhook unreachable" });
    }
  });

  // AI Commentary
  app.post("/api/gemini/commentary", async (req, res) => {
    try {
      const { lastBall, state } = req.body;
      const ai = getAi();
      if (!ai) {
        return res.json({ commentary: lastBall?.isWicket ? "WICKET! Massive moment in this match!" : lastBall?.runs >= 4 ? "SHOT! That is crunched away with absolute authority!" : "Solid delivery, played into the gap." });
      }

      const prompt = `
        You are the legendary cricket commentator Ian Bishop.
        
        Match Context:
        - Score: ${state?.totalRuns}/${state?.wickets}
        - Overs: ${state?.currentOver}.${state?.currentBall}
        - Event: ${lastBall?.description || ''} (Runs: ${lastBall?.runs}, Wicket: ${lastBall?.isWicket})
        
        Write a single, electrifying line of commentary (max 20 words) for this ball.
        
        Style Guidelines:
        - Use Ian Bishop's iconic voice: passionate, deep, and poetic.
        - If it's a SIX or WICKET: Go absolutely wild. Use phrases like "REMEMBER THE NAME!", "INTO THE ORBIT!", "MAGNIFICENT!", "ABSOLUTE CARNAGE!", "THAT IS HUGE!".
        - If it's a dot ball: Be analytical but intense. Praise the bowler's line and length using words like "Corridor of uncertainty", "Absolute beauty", "Peach of a delivery".
        - Do not sound generic. Sound like you are in the commentary box at a T20 World Cup final.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      res.json({ commentary: response.text?.trim() || "Oh, what a delivery! Absolute beauty!" });
    } catch (err) {
      console.error("Gemini Commentary error:", err);
      res.json({ commentary: "Oh, what a delivery! Absolute beauty!" });
    }
  });

  // AI Speech TTS
  app.post("/api/gemini/speech", async (req, res) => {
    try {
      const { text } = req.body;
      const ai = getAi();
      if (!ai || !text) {
        return res.json({ audio: null });
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts: [{ text: `Say this in a HIGHLY ENERGETIC, passionate sports commentator voice: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Charon' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
      res.json({ audio: base64Audio || null });
    } catch (err) {
      console.error("Gemini TTS error:", err);
      res.json({ audio: null });
    }
  });

  // AI Rule query
  app.post("/api/gemini/rule", async (req, res) => {
    try {
      const { query } = req.body;
      const ai = getAi();
      if (!ai) {
        return res.json({ answer: "ICC Playing Conditions state that play must follow the Laws of Cricket standard code." });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Answer this cricket rule question briefly based on ICC Playing Conditions: ${query}`,
      });

      res.json({ answer: response.text?.trim() || "Refer to standard ICC cricket match conditions." });
    } catch (err) {
      console.error("Gemini Rule error:", err);
      res.json({ answer: "Unable to retrieve rule at this time." });
    }
  });

  // AI Match Summary
  app.post("/api/gemini/summary", async (req, res) => {
    try {
      const { state } = req.body;
      const ai = getAi();
      if (!ai || !state) {
        return res.json({ summary: "A fiercely contested encounter concluded with high intensity and competitive spirit from both teams." });
      }

      const summaryData = {
        score: `${state.totalRuns}/${state.wickets}`,
        overs: `${state.currentOver}.${state.currentBall}`,
        topBatters: state.battingTeam?.players ? [...state.battingTeam.players].sort((a: any, b: any) => b.runs - a.runs).slice(0, 2).map((p: any) => `${p.name} (${p.runs})`) : [],
        keyEvents: state.ballHistory ? state.ballHistory.filter((b: any) => b.isWicket || b.runs >= 4).length : 0
      };

      const prompt = `
        You are Ian Bishop summarizing a cricket match.
        Data: ${JSON.stringify(summaryData)}
        
        Write a 2-sentence post-match summary. 
        Use your signature dramatic flair. If the score is high, call it a "batting masterclass" or "power-hitting display". If wickets fell, call it "absolute destruction" or "bowling wizardry".
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      res.json({ summary: response.text?.trim() || "Match concluded." });
    } catch (err) {
      console.error("Gemini Summary error:", err);
      res.json({ summary: "Match concluded." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
