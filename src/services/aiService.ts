import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const aiService = {
  async sendMessage(message: string, chatHistory: { role: "user" | "model"; parts: { text: string }[] }[]) {
    try {
      // Use the model directly from the ai object as per skills recommendation
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          ...chatHistory,
          { role: "user", parts: [{ text: message }] }
        ],
      });

      return response.text || "Sorry, I couldn't generate a response.";
    } catch (e) {
      console.error("AI Service Error:", e);
      throw e;
    }
  },
};
