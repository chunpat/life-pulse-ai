
import { GoogleGenAI, Type } from "@google/genai";
import { LogEntry } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseLifeLog = async (text: string): Promise<Partial<LogEntry>> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Parse the following daily log note into a structured JSON object: "${text}"`,
    config: {
      systemInstruction: `You are an expert life-logging assistant. Your job is to extract activities and metadata from casual user notes. 
      - Category must be one of: Work, Leisure, Health, Chores, Social, Other.
      - Duration: If not mentioned, estimate a reasonable duration based on the activity.
      - Mood: Briefly describe the vibe (e.g., Happy, Tired, Productive).
      - Importance: Rate from 1 (trivial) to 5 (significant).
      - If multiple activities are mentioned, focus on the primary one or combine them logically.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          activity: { type: Type.STRING },
          category: { type: Type.STRING, enum: ['Work', 'Leisure', 'Health', 'Chores', 'Social', 'Other'] },
          durationMinutes: { type: Type.NUMBER },
          mood: { type: Type.STRING },
          importance: { type: Type.NUMBER },
        },
        required: ["activity", "category", "durationMinutes", "mood", "importance"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text.trim());
    return data;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    throw new Error("AI failed to structure the data.");
  }
};

export const getDailyInsight = async (logs: LogEntry[]): Promise<string> => {
  if (logs.length === 0) return "Start logging to get AI insights!";
  
  const logSummary = logs.map(l => `${l.activity} (${l.durationMinutes}m, ${l.category})`).join(', ');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Review my day and provide a short, motivating summary or insight about where my time went and how I can improve: ${logSummary}`,
    config: {
      systemInstruction: "Keep it under 3 sentences. Be supportive and analytical."
    }
  });
  
  return response.text.trim();
};
