import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { brainstormGeminiFunctionDeclarations } from "@/lib/ai/geminiTools";
import { BRAINSTORM_SYSTEM_PROMPT } from "@/lib/ai/systemPrompt";

export const maxDuration = 60;

type Body = {
  transcript?: string;
  canvas?: unknown;
  roomId?: string;
};

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Задайте GEMINI_API_KEY (или GOOGLE_API_KEY) в .env.local" },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json({ error: "Пустой transcript" }, { status: 400 });
  }

  const modelName =
    process.env.GEMINI_MODEL ?? process.env.GOOGLE_GEMINI_MODEL ?? "gemini-2.0-flash";

  const userPayload = {
    transcript,
    roomId: body.roomId ?? null,
    canvas: body.canvas ?? null,
  };

  const userText = `Снимок холста и транскрипт:\n\n${JSON.stringify(userPayload, null, 2)}`;

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: BRAINSTORM_SYSTEM_PROMPT,
    tools: [{ functionDeclarations: brainstormGeminiFunctionDeclarations }],
  });

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userText }] }],
    });

    const response = result.response;
    const parts = response.candidates?.[0]?.content?.parts ?? [];

    const textParts: string[] = [];
    const toolUses: { id: string; name: string; input: unknown }[] = [];
    let fc = 0;

    for (const part of parts) {
      if (typeof part.text === "string" && part.text.trim()) {
        textParts.push(part.text);
      }
      if (part.functionCall) {
        const name = part.functionCall.name;
        const args = part.functionCall.args ?? {};
        toolUses.push({
          id: `call_${fc++}`,
          name,
          input: args,
        });
      }
    }

    return NextResponse.json({
      text: textParts.join("\n").trim(),
      toolUses,
      model: modelName,
      stopReason: response.candidates?.[0]?.finishReason ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const lower = message.toLowerCase();
    const is429 =
      lower.includes("429") ||
      lower.includes("too many requests") ||
      lower.includes("resource exhausted") ||
      lower.includes("quota");
    return NextResponse.json({ error: message }, { status: is429 ? 429 : 502 });
  }
}
