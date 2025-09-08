
import { GoogleGenAI, Type } from "@google/genai";
import type { OcrPayload, LlmAnswer } from "../types";
import type { CapturedImage } from "../utils/imageCapture";

// FIX: Removed placeholder API key logic. The API key must be provided via the `process.env.API_KEY` environment variable.

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeImageForAssessment(
  image: CapturedImage,
  signal: AbortSignal
): Promise<LlmAnswer> {
  const prompt = `Analyze image for assessment question. Return ONLY valid JSON:

{
  "answerId": "A", 
  "confidence": 0.9,
  "instruction": "",
  "justification": "brief reason",
  "questionText": "full question text here",
  "options": [{"id": "A", "text": "option text"}]
}

Multiple choice: use option ID ("A", "B", "1", "2")
Multiple select: comma-separated ("1,3,5") 
No question: use "NO_QUESTION"
Interactive: add brief instruction
ALWAYS include questionText and options arrays for fingerprinting
High confidence (0.8+) if clear.`.trim();

  try {
    console.log("Making Gemini Vision API call...");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: image.base64,
                mimeType: image.mimeType
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      config: { 
        temperature: 0.1, 
        maxOutputTokens: 1000
      },
    });

    if (signal.aborted) {
      throw new Error('AbortError');
    }

    console.log("Gemini Vision API response received");
    console.log("Response candidates length:", response.candidates?.length);
    
    // Check for MAX_TOKENS issue
    if (response.candidates && response.candidates[0]?.finishReason === 'MAX_TOKENS') {
      console.warn("Response was truncated due to MAX_TOKENS. UsageMetadata:", response.usageMetadata);
      throw new Error("Response truncated due to token limit. Try reducing image size or prompt complexity.");
    }
    
    console.log("Full response structure:", JSON.stringify(response, null, 2));
    
    // Extract text from response using the getter property
    let jsonText;
    try {
      // The GenerateContentResponse should have a text getter
      jsonText = response.text;
      
      if (!jsonText) {
        console.log("No direct text, trying manual extraction...");
        // Fallback: manual extraction from candidates
        if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0];
          console.log("First candidate structure:", candidate);
          
          if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            const part = candidate.content.parts[0];
            console.log("First part structure:", part);
            jsonText = part.text;
          }
        }
      }
      
      if (!jsonText) {
        throw new Error("Could not extract text from any available source");
      }
      
      console.log("Extracted text length:", jsonText.length);
      console.log("Raw response text:", jsonText);
    } catch (extractError) {
      console.error("Error extracting text from response:", extractError);
      throw new Error(`Failed to extract text from Gemini response: ${extractError.message}`);
    }
    let parsed;
    
    try {
      if (!jsonText || jsonText.length === 0) {
        throw new Error("Empty response text from Gemini");
      }
      
      // Strip markdown code blocks if present
      let cleanedJsonText = jsonText.trim();
      if (cleanedJsonText.startsWith('```json')) {
        cleanedJsonText = cleanedJsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedJsonText.startsWith('```')) {
        cleanedJsonText = cleanedJsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      parsed = JSON.parse(cleanedJsonText);
    } catch (parseError) {
      console.error("JSON parse error. Raw response:", jsonText);
      console.error("Parse error details:", parseError);
      
      // Try to fix common truncation issues
      if (jsonText.includes('"justification"') && !jsonText.trim().endsWith('}')) {
        console.warn("Attempting to fix truncated JSON response");
        try {
          // Try to close the JSON properly
          let fixedJson = jsonText.trim();
          if (fixedJson.endsWith('",')) {
            fixedJson += ' "justification": "Response truncated"}';
          } else if (fixedJson.endsWith('"')) {
            fixedJson += ', "justification": "Response truncated"}';
          } else {
            fixedJson += '"}';
          }
          
          parsed = JSON.parse(fixedJson);
          console.warn("Successfully fixed truncated JSON");
        } catch (fixError) {
          console.error("Failed to fix JSON:", fixError);
          // Fallback: return a safe default response
          parsed = {
            answerId: "NO_QUESTION",
            confidence: 0.1,
            instruction: "",
            justification: "JSON parsing failed",
            questionText: "",
            options: []
          };
          console.warn("Using fallback response due to parsing failure");
        }
      } else {
        // Fallback: return a safe default response
        parsed = {
          answerId: "NO_QUESTION",
          confidence: 0.1,
          instruction: "",
          justification: "Invalid JSON response",
          questionText: "",
          options: []
        };
        console.warn("Using fallback response due to JSON parse error");
      }
    }

    if (!parsed.answerId || typeof parsed.confidence !== 'number') {
      throw new Error("Invalid Gemini output: missing answerId or confidence");
    }

    return parsed as LlmAnswer;
  } catch (error) {
    if (signal.aborted) {
      throw new Error('AbortError');
    }
    console.error("Error analyzing image with Gemini:", error);
    throw error;
  }
}

export async function askModel(
  p: OcrPayload,
  signal: AbortSignal
): Promise<LlmAnswer> {

  const prompt = `
You are an expert in Microsoft Azure services, architecture, governance, and best practices.
Base all reasoning and answers on authoritative Azure knowledge, including cloud fundamentals, infrastructure, security, identity, governance, and AI/ML services.

Output ONLY valid JSON that conforms to the provided schema.

Guidelines:

Multiple-choice/numeric: "instruction" should be an empty string.

Drag-and-drop: "instruction" should be a concise imperative like "drag X to Y".

Lab/performance: "instruction" should be a concise imperative like "enable firewall".

Keep "instruction" under 15 words.

Base your answer on the provided question and options.

The "answerId" must correspond to one of the provided option IDs for multiple-choice questions. For free-form questions, it can be a numeric string or short text.

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
            maxOutputTokens: 400,
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

    let jsonText = response.text.trim();
    let parsed;
    
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("JSON parse error. Raw response:", jsonText);
      
      // Try to fix common truncation issues
      if (jsonText.includes('"justification": "') && !jsonText.endsWith('"}')) {
        console.warn("Attempting to fix truncated JSON response");
        // Find the last complete field and close the JSON properly
        const lastCompleteField = jsonText.lastIndexOf('",');
        if (lastCompleteField > 0) {
          jsonText = jsonText.substring(0, lastCompleteField + 1) + ' "justification": "Response truncated"}';
          try {
            parsed = JSON.parse(jsonText);
            console.warn("Successfully fixed truncated JSON");
          } catch (fixError) {
            throw new Error(`Invalid JSON response from Gemini: ${parseError.message}`);
          }
        } else {
          throw new Error(`Invalid JSON response from Gemini: ${parseError.message}`);
        }
      } else {
        throw new Error(`Invalid JSON response from Gemini: ${parseError.message}`);
      }
    }

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
