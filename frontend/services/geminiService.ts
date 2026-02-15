import { GoogleGenAI } from '@google/genai';

const apiKey = typeof process !== 'undefined' && process.env?.GEMINI_API_KEY;

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const rewriteInNoir = async (text: string): Promise<string> => {
  if (!ai || !text) return text;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: text,
      config: {
        systemInstruction:
          'You are a 1930s noir detective film narrator. Rewrite the provided social media post in your signature style. Keep it atmospheric, gritty, and under 25 words.',
        temperature: 0.8,
        topP: 0.9,
      },
    });
    return response.text ?? text;
  } catch (error) {
    console.error('Noir rewrite failed:', error);
    return text;
  }
};
