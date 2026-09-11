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

// Auto-sync local accounts and data with server
export const initServerSync = async (): Promise<void> => {
  try {
    const localAccounts = getTeamAccounts();
    const res = await fetch('/api/accounts/sync-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accounts: localAccounts }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.accounts && Array.isArray(data.accounts)) {
        saveTeamAccounts(data.accounts);
      }
    }

    const activeId = getActiveAccountId();
    if (activeId) {
      const dataRes = await fetch(`/api/accounts/${activeId}/data`);
      if (dataRes.ok) {
        const teamData = await dataRes.json();
        if (teamData.data) {
          if (Array.isArray(teamData.data.matches) && teamData.data.matches.length > 0) {
            localStorage.setItem(getScopedKey('matches', activeId), JSON.stringify(teamData.data.matches));
          }
          if (Array.isArray(teamData.data.teams) && teamData.data.teams.length > 0) {
            localStorage.setItem(getScopedKey('teams', activeId), JSON.stringify(teamData.data.teams));
          }
        }
      }
    }

    // Also pull latest developer DB config from server if available
    const devRes = await fetch('/api/dev/config');
    if (devRes.ok) {
      const devData = await devRes.json();
      if (devData.config && devData.config.sheetWebhookUrl) {
        const localDev = getDeveloperDbConfig();
        if (!localDev.sheetWebhookUrl) {
          saveDeveloperDbConfig({ ...localDev, ...devData.config });
        }
      }
    }
  } catch (err) {
    // Offline or server warming up
  }
};

// Run initial sync on module load
if (typeof window !== 'undefined') {
  initServerSync();
}

export interface RegisterTeamParams {
  teamName: string;
  username: string;
  password: string;
  city?: string;
  managerName?: string;
  logoUrl?: string;
  initialSquad?: string[];
}

export const registerTeamAccount = async (
  params: RegisterTeamParams
): Promise<{ success: boolean; error?: string; account?: TeamAccount }> => {
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

  // 1. Try server registration first (ensures cross-device availability)
  try {
    const response = await fetch('/api/accounts/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (response.ok && data.success && data.account) {
      const accounts = getTeamAccounts();
      const existingIdx = accounts.findIndex(a => a.id === data.account.id || a.username.toLowerCase() === trimmedUser);
      if (existingIdx >= 0) {
        accounts[existingIdx] = data.account;
      } else {
        accounts.push(data.account);
      }
      saveTeamAccounts(accounts);
      setActiveAccountId(data.account.id);

      if (data.teams && Array.isArray(data.teams)) {
        localStorage.setItem(getScopedKey('teams', data.account.id), JSON.stringify(data.teams));
      }

      return { success: true, account: data.account };
    } else if (data && !data.success) {
      return { success: false, error: data.error || 'Registration failed.' };
    }
  } catch (netErr) {
    console.warn('Server offline during registration, saving to local device', netErr);
  }

  // 2. Offline fallback
  const accounts = getTeamAccounts();
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

export const loginTeamAccount = async (
  username: string,
  password: string
): Promise<{ success: boolean; error?: string; account?: TeamAccount }> => {
  const trimmedUser = username.trim().toLowerCase();

  // 1. Try server login first (ensures cross-device login works seamlessly)
  try {
    const response = await fetch('/api/accounts/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: trimmedUser, password }),
    });
    const data = await response.json();

    if (response.ok && data.success && data.account) {
      const accounts = getTeamAccounts();
      const existingIdx = accounts.findIndex(a => a.id === data.account.id || a.username.toLowerCase() === trimmedUser);
      if (existingIdx >= 0) {
        accounts[existingIdx] = data.account;
      } else {
        accounts.push(data.account);
      }
      saveTeamAccounts(accounts);
      setActiveAccountId(data.account.id);

      // Cache downloaded matches and squads
      if (data.matches && Array.isArray(data.matches)) {
        localStorage.setItem(getScopedKey('matches', data.account.id), JSON.stringify(data.matches));
      }
      if (data.teams && Array.isArray(data.teams)) {
        localStorage.setItem(getScopedKey('teams', data.account.id), JSON.stringify(data.teams));
      }

      return { success: true, account: data.account };
    } else if (response.status === 401 || response.status === 400 || (data && !data.success)) {
      return { success: false, error: data.error || 'Login failed.' };
    }
  } catch (netErr) {
    console.warn('Server offline during login, checking local storage', netErr);
  }

  // 2. Offline fallback
  const accounts = getTeamAccounts();
  const account = accounts.find(a => a.username.toLowerCase() === trimmedUser);
  if (!account) {
    return { success: false, error: 'Account not found with this username. Check spelling or connect to internet.' };
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

export const resetTeamPasswordWithPin = async (
  username: string,
  adminPin: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  const trimmedUser = username.trim().toLowerCase();
  if (!trimmedUser) {
    return { success: false, error: 'Please enter your team username.' };
  }

  // 1. Try server reset
  try {
    const response = await fetch('/api/accounts/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: trimmedUser, adminPin, newPassword }),
    });
    const data = await response.json();
    if (response.ok && data.success) {
      const accounts = getTeamAccounts();
      const accountIndex = accounts.findIndex(a => a.username.toLowerCase() === trimmedUser);
      if (accountIndex >= 0) {
        accounts[accountIndex].passwordHash = hashPassword(newPassword);
        saveTeamAccounts(accounts);
      }
      return { success: true };
    } else if (data && !data.success) {
      return { success: false, error: data.error || 'Password reset failed.' };
    }
  } catch (err) {
    console.warn('Server offline during reset, falling back to local verification', err);
  }

  // 2. Offline fallback
  const devConfig = getDeveloperDbConfig();
  const validPin = devConfig.adminPin || '1234';

  if (!adminPin || adminPin.trim() !== validPin) {
    return { success: false, error: 'Incorrect Developer / Admin PIN. (Default is 1234 unless customized).' };
  }

  if (!newPassword || newPassword.length < 4) {
    return { success: false, error: 'New password must be at least 4 characters long.' };
  }

  const accounts = getTeamAccounts();
  const accountIndex = accounts.findIndex(a => a.username.toLowerCase() === trimmedUser);

  if (accountIndex === -1) {
    return { success: false, error: `No registered team found with username "${username}".` };
  }

  accounts[accountIndex].passwordHash = hashPassword(newPassword);
  saveTeamAccounts(accounts);

  return { success: true };
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

  const id = accountId || getActiveAccountId();
  if (id) {
    fetch(`/api/accounts/${id}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teams }),
    }).catch(err => console.warn('Background sync teams failed:', err));
  }
};

export const deleteTeam = (teamId: string, accountId?: string) => {
  const key = getScopedKey('teams', accountId);
  const teams = getSavedTeams(accountId).filter(t => t.id !== teamId);
  localStorage.setItem(key, JSON.stringify(teams));

  const id = accountId || getActiveAccountId();
  if (id) {
    fetch(`/api/accounts/${id}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teams }),
    }).catch(err => console.warn('Background sync teams failed:', err));
  }
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

  const id = accountId || getActiveAccountId();
  if (id) {
    fetch(`/api/accounts/${id}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matches }),
    }).catch(err => console.warn('Background sync matches failed:', err));
  }
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

// --- DEVELOPER DATABASE (GOOGLE SHEETS) CONFIGURATION ---

export interface DeveloperDbConfig {
  sheetWebhookUrl: string;
  autoSyncOnMatchEnd: boolean;
  adminPin: string;
  lastSyncTimestamp?: number;
  lastSyncStatus?: 'SUCCESS' | 'FAILED' | 'IDLE';
}

const DEV_DB_CONFIG_KEY = 'crictiger_developer_db_config_v2';

export const getDeveloperDbConfig = (): DeveloperDbConfig => {
  try {
    const raw = localStorage.getItem(DEV_DB_CONFIG_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to get developer db config', err);
  }
  return {
    sheetWebhookUrl: '',
    autoSyncOnMatchEnd: true,
    adminPin: '1234',
    lastSyncStatus: 'IDLE'
  };
};

export const saveDeveloperDbConfig = (config: DeveloperDbConfig) => {
  try {
    localStorage.setItem(DEV_DB_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save developer db config', err);
  }
};
