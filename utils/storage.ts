import { SavedTeam, MatchState, TeamAccount } from '../types';

// Storage keys
const ACCOUNTS_KEY = 'crictiger_team_accounts_v1';
const ACTIVE_ACCOUNT_KEY = 'crictiger_active_account_id_v1';
const PURGED_LEGACY_KEY = 'crictiger_legacy_purged_v3';

// Clean up previous unauthenticated legacy mock data
export const purgeOldLegacyData = () => {
  try {
    if (!localStorage.getItem(PURGED_LEGACY_KEY)) {
      localStorage.removeItem('cricket_app_teams');
      localStorage.removeItem('cricket_app_matches');
      localStorage.removeItem('crictiger_draft_match');
      localStorage.removeItem('crictiger_draft_view');
      localStorage.removeItem('crictiger_draft_setup');
      localStorage.setItem(PURGED_LEGACY_KEY, 'true');
    }
  } catch (err) {
    console.error('Failed to purge legacy data', err);
  }
};

// Immediate purge on script load
purgeOldLegacyData();

// --- ACCOUNT & AUTH MANAGEMENT ---

export const getTeamAccounts = (): TeamAccount[] => {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse accounts', err);
    return [];
  }
};

export const saveTeamAccounts = (accounts: TeamAccount[]) => {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
};

export const getActiveAccountId = (): string | null => {
  return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
};

export const setActiveAccountId = (accountId: string | null) => {
  if (accountId) {
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
  } else {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  }
};

export const getCurrentTeamAccount = (): TeamAccount | null => {
  const activeId = getActiveAccountId();
  if (!activeId) return null;
  const accounts = getTeamAccounts();
  return accounts.find(a => a.id === activeId) || null;
};

// Simple secure hash simulation for client password verification
const hashPassword = (pw: string): string => {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    hash = (hash << 5) - hash + pw.charCodeAt(i);
    hash |= 0;
  }
  return 'ct_' + Math.abs(hash).toString(16) + '_' + pw.length;
};

export interface RegisterTeamParams {
  teamName: string;
  username: string;
  password: string;
  city?: string;
  managerName?: string;
  logoUrl?: string;
  initialSquad?: string[];
}

export const registerTeamAccount = (
  params: RegisterTeamParams
): { success: boolean; error?: string; account?: TeamAccount } => {
  const accounts = getTeamAccounts();
  const trimmedUser = params.username.trim().toLowerCase();
  const trimmedTeam = params.teamName.trim();

  if (!trimmedUser || trimmedUser.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters.' };
  }
  if (!trimmedTeam) {
    return { success: false, error: 'Team name is required.' };
  }
  if (!params.password || params.password.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters.' };
  }

  // Check unique username
  const existing = accounts.find(a => a.username.toLowerCase() === trimmedUser);
  if (existing) {
    return { success: false, error: 'A team with this username already exists. Please choose another username.' };
  }

  const accountId = 'acc_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7);
  const newAccount: TeamAccount = {
    id: accountId,
    teamName: trimmedTeam,
    username: trimmedUser,
    passwordHash: hashPassword(params.password),
    city: params.city?.trim() || undefined,
    managerName: params.managerName?.trim() || undefined,
    logoUrl: params.logoUrl || undefined,
    createdAt: Date.now(),
  };

  accounts.push(newAccount);
  saveTeamAccounts(accounts);
  setActiveAccountId(accountId);

  // Initialize the team's primary club squad in their isolated storage
  const primaryTeam: SavedTeam = {
    id: `team_${accountId}_primary`,
    name: trimmedTeam,
    logoUrl: params.logoUrl || undefined,
    squad: (params.initialSquad && params.initialSquad.length >= 11)
      ? params.initialSquad
      : Array.from({ length: 15 }, (_, i) => `${trimmedTeam} Player ${i + 1}`),
  };

  saveTeam(primaryTeam, accountId);

  return { success: true, account: newAccount };
};

export const loginTeamAccount = (
  username: string,
  password: string
): { success: boolean; error?: string; account?: TeamAccount } => {
  const accounts = getTeamAccounts();
  const trimmedUser = username.trim().toLowerCase();

  const account = accounts.find(a => a.username.toLowerCase() === trimmedUser);
  if (!account) {
    return { success: false, error: 'Account not found with this username.' };
  }

  if (account.passwordHash !== hashPassword(password)) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  setActiveAccountId(account.id);
  return { success: true, account };
};

export const logoutTeamAccount = () => {
  setActiveAccountId(null);
};

// --- TEAM-ISOLATED DATA ACCESSORS ---

const getScopedKey = (base: string, accountId?: string): string => {
  const id = accountId || getActiveAccountId() || 'guest';
  return `crictiger_${base}_${id}`;
};

export const getSavedTeams = (accountId?: string): SavedTeam[] => {
  try {
    const key = getScopedKey('teams', accountId);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load scoped teams', error);
    return [];
  }
};

export const saveTeam = (team: SavedTeam, accountId?: string) => {
  const key = getScopedKey('teams', accountId);
  const teams = getSavedTeams(accountId);
  const index = teams.findIndex(t => t.id === team.id);
  if (index >= 0) {
    teams[index] = team;
  } else {
    teams.push(team);
  }
  localStorage.setItem(key, JSON.stringify(teams));
};

export const deleteTeam = (teamId: string, accountId?: string) => {
  const key = getScopedKey('teams', accountId);
  const teams = getSavedTeams(accountId).filter(t => t.id !== teamId);
  localStorage.setItem(key, JSON.stringify(teams));
};

// --- TEAM-ISOLATED MATCH HISTORY ---

export const getSavedMatches = (accountId?: string): MatchState[] => {
  try {
    const key = getScopedKey('matches', accountId);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load scoped match history', error);
    return [];
  }
};

export const saveMatch = (match: MatchState, accountId?: string) => {
  const key = getScopedKey('matches', accountId);
  const matches = getSavedMatches(accountId);
  matches.push(match);
  localStorage.setItem(key, JSON.stringify(matches));
};

export const clearMatches = (accountId?: string) => {
  const key = getScopedKey('matches', accountId);
  localStorage.removeItem(key);
};

// --- TEAM-ISOLATED DRAFT RECOVERY ---

export const getDraftMatch = (accountId?: string): { matchState: MatchState; view: string; setupData: any } | null => {
  try {
    const key = getScopedKey('draft', accountId);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load scoped draft', error);
    return null;
  }
};

export const saveDraftMatch = (
  draft: { matchState: MatchState; view: string; setupData: any },
  accountId?: string
) => {
  const key = getScopedKey('draft', accountId);
  localStorage.setItem(key, JSON.stringify(draft));
};

export const clearDraftMatch = (accountId?: string) => {
  const key = getScopedKey('draft', accountId);
  localStorage.removeItem(key);
};
