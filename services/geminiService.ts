import { GoogleGenAI, Modality } from "@google/genai";
import { MatchState, BallEvent } from '../types';

// NOTE: Use GEMINI_API_KEY as per React guidelines in skill
const API_KEY = process.env.GEMINI_API_KEY || '';

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
}

export const generateCommentary = async (lastBall: BallEvent, state: MatchState): Promise<string> => {
  if (!ai) return "Gemini API Key missing.";

  const prompt = `
    You are the legendary cricket commentator Ian Bishop.
    
    Match Context:
    - Score: ${state.totalRuns}/${state.wickets}
    - Overs: ${state.currentOver}.${state.currentBall}
    - Event: ${lastBall.description} (Runs: ${lastBall.runs}, Wicket: ${lastBall.isWicket})
    
    Write a single, electrifying line of commentary (max 20 words) for this ball.
    
    Style Guidelines:
    - Use Ian Bishop's iconic voice: passionate, deep, and poetic.
    - If it's a SIX or WICKET: Go absolutely wild. Use phrases like "REMEMBER THE NAME!", "INTO THE ORBIT!", "MAGNIFICENT!", "ABSOLUTE CARNAGE!", "THAT IS HUGE!".
    - If it's a dot ball: Be analytical but intense. Praise the bowler's line and length using words like "Corridor of uncertainty", "Absolute beauty", "Peach of a delivery".
    - Do not sound generic. Sound like you are in the commentary box at a T20 World Cup final.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Oh, what a delivery! Absolute beauty!";
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  if (!ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say this in a HIGHLY ENERGETIC, passionate, and professional sports commentator style (Ian Bishop style): ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            // 'Fenrir' or 'Zephyr' are likely more intense. Let's try 'Charon' or 'Zephyr'.
            prebuiltVoiceConfig: { voiceName: 'Charon' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return null;
  }
};

export const askRuleQuestion = async (query: string): Promise<string> => {
  if (!ai) return "AI service unavailable.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Answer this cricket rule question briefly based on ICC Playing Conditions: ${query}`,
    });
    return response.text.trim();
  } catch (error) {
    return "Unable to fetch rule.";
  }
};

export const generateMatchSummary = async (state: MatchState): Promise<string> => {
  if (!ai) return "AI service unavailable.";
  
  const summaryData = {
    score: `${state.totalRuns}/${state.wickets}`,
    overs: `${state.currentOver}.${state.currentBall}`,
    topBatters: state.battingTeam.players.sort((a,b) => b.runs - a.runs).slice(0, 2).map(p => `${p.name} (${p.runs})`),
    keyEvents: state.ballHistory.filter(b => b.isWicket || b.runs >= 4).length
  };

  const prompt = `
    You are Ian Bishop summarizing a cricket match.
    Data: ${JSON.stringify(summaryData)}
    
    Write a 2-sentence post-match summary. 
    Use your signature dramatic flair. If the score is high, call it a "batting masterclass" or "power-hitting display". If wickets fell, call it "absolute destruction" or "bowling wizardry".
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return "Match concluded.";
  }
};