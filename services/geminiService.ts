import { MatchState, BallEvent } from '../types';

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 3500): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

export const generateCommentary = async (lastBall: BallEvent, state: MatchState): Promise<string> => {
  try {
    const res = await fetchWithTimeout('/api/gemini/commentary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastBall, state })
    }, 3000);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    return data.commentary || "Oh, what a delivery! Absolute beauty!";
  } catch (error) {
    if (lastBall.isWicket) return "WICKET! Massive breakthrough in this match!";
    if (lastBall.runs === 6) return "SIX! That has disappeared high into the stands!";
    if (lastBall.runs === 4) return "FOUR! Pure timing, crunched away to the boundary fence!";
    if (lastBall.runs === 0) return "Dot ball. Excellent line and length on that delivery.";
    return `${lastBall.runs} run${lastBall.runs > 1 ? 's' : ''} pushed into the gap nicely.`;
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const res = await fetchWithTimeout('/api/gemini/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    }, 3500);
    if (!res.ok) return null;
    const data = await res.json();
    return data.audio || null;
  } catch (error) {
    return null;
  }
};

export const askRuleQuestion = async (query: string): Promise<string> => {
  try {
    const res = await fetchWithTimeout('/api/gemini/rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    }, 4000);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    return data.answer || "ICC match regulations govern this scenario.";
  } catch (error) {
    return "Refer to MCC Laws of Cricket and standard ICC match regulations.";
  }
};

export const generateMatchSummary = async (state: MatchState): Promise<string> => {
  try {
    const res = await fetchWithTimeout('/api/gemini/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state })
    }, 4500);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    return data.summary || "A fiercely contested match concluded with outstanding commitment from both teams.";
  } catch (error) {
    return "A fantastic display of cricket concluded today. Both sides fought hard in this high-stakes encounter.";
  }
};
