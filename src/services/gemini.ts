import { Resume } from "../types";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Prefer OpenRouter if key is available, fallback to direct Gemini if needed
const USE_OPENROUTER = !!OPENROUTER_API_KEY;

async function callAI(prompt: string, jsonMode: boolean = false) {
  if (USE_OPENROUTER) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "ProCurrículo"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: jsonMode ? { type: "json_object" } : undefined
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "OpenRouter API Error");
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } else {
    // Fallback to direct Gemini SDK if OpenRouter is not configured
    // (Importing dynamically to avoid errors if SDK is not used)
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const model = "gemini-3-flash-preview";
    
    const result = await ai.models.generateContent({
      model,
      contents: prompt,
      config: jsonMode ? { responseMimeType: "application/json" } : undefined
    });

    return result.text;
  }
}

export async function evaluateResume(resume: Resume) {
  const prompt = `Avalie este currículo e dê uma pontuação de 0 a 100 baseada em clareza, impacto e profissionalismo. 
  Forneça também 3 dicas específicas de melhoria em português.
  Retorne APENAS um objeto JSON com os campos: score (número), feedback (string), tips (array de strings).
  
  Currículo:
  ${JSON.stringify(resume, null, 2)}`;

  const text = await callAI(prompt, true);
  return JSON.parse(text);
}

export async function generateInterviewQuestions(resume: Resume) {
  const prompt = `Com base neste currículo, gere 5 perguntas comuns de entrevista de emprego em português.
  Retorne APENAS um array JSON de objetos com os campos: question (string), hint (string).
  
  Currículo:
  ${JSON.stringify(resume, null, 2)}`;

  const text = await callAI(prompt, true);
  return JSON.parse(text);
}

export async function getFeedbackOnAnswer(question: string, answer: string) {
  const prompt = `Pergunta: ${question}
  Resposta do candidato: ${answer}
  
  Dê um feedback construtivo sobre a resposta e como melhorá-la. Responda em português.`;

  return await callAI(prompt, false);
}
