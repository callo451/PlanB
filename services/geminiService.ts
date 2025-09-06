
import { GoogleGenAI, Type } from "@google/genai";
import type { OcrPayload, LlmAnswer } from "../types";

// FIX: Removed placeholder API key logic. The API key must be provided via the `process.env.API_KEY` environment variable.

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function askModel(
  p: OcrPayload,
  signal: AbortSignal
): Promise<LlmAnswer> {

  const prompt = `
You are assisting with an educational practice system. 
Help learners by selecting the best answer and, when relevant, 
giving a very short action hint.

Output ONLY valid JSON that conforms to the provided schema.

Guidelines:
- Multiple-choice/numeric: "instruction" should be an empty string.
- Drag-and-drop: "instruction" should be a concise imperative like "drag X to Y".
- Lab/performance: "instruction" should be a concise imperative like "enable firewall".
- Keep "instruction" under 15 words.
- Base your answer on the provided question and options.
- The 'answerId' must correspond to one of the provided option IDs for multiple-choice questions. For free-form questions, it can be a numeric string or short text.

Question:
${p.stem}

Options (JSON):
${JSON.stringify(p.options)}
  `.trim();

  try {
     const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { 
            temperature: 0.2, 
            maxOutputTokens: 200,
            // FIX: Added thinkingConfig to reserve tokens for the output when maxOutputTokens is set for gemini-2.5-flash.
            thinkingConfig: { thinkingBudget: 100 },
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    answerId: { 
                        type: Type.STRING,
                        description: "The ID of the correct option, a numeric string, or short text answer."
                    },
                    confidence: {
                        type: Type.NUMBER,
                        description: "Your confidence in the answer, from 0.0 to 1.0."
                    },
                    instruction: {
                        type: Type.STRING,
                        description: "A very short instructional hint (under 15 words) if the task is interactive, otherwise an empty string."
                    },
                    justification: {
                        type: Type.STRING,
                        description: "A brief justification for your answer, for logging and auditing purposes."
                    }
                },
                required: ["answerId", "confidence", "instruction", "justification"],
            },
        },
    });

    if (signal.aborted) {
        throw new Error('AbortError');
    }

    const jsonText = response.text.trim();
    const parsed = JSON.parse(jsonText);

    if (!parsed.answerId || typeof parsed.confidence !== 'number') {
      throw new Error("Invalid Gemini output: missing answerId or confidence");
    }

    return parsed as LlmAnswer;
  } catch (error) {
     if (signal.aborted) {
        throw new Error('AbortError');
     }
    console.error("Error generating content from Gemini:", error);
    throw error;
  }
}
