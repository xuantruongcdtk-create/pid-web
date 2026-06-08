/**
 * Google Gemini client wrapper for PID.
 *
 * Why this file exists: the rest of the codebase (analyze, quiz-generate,
 * coach, dna routes) talks to AI through these helpers, so swapping models
 * or providers only touches this file.
 *
 * Models:
 *   - PRO   (gemini-2.5-pro)   — quiz generation + score analysis (quality)
 *   - FLASH (gemini-2.0-flash) — AI Coach chat (latency + free tier)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export const GEMINI_PRO_MODEL = process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro";
export const GEMINI_FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || "gemini-2.0-flash";

/** Cached client (one per process). */
let _client: GoogleGenerativeAI | null = null;
function client(): GoogleGenerativeAI {
  if (!_client) {
    const key = process.env.GOOGLE_AI_API_KEY;
    if (!key) throw new Error("GOOGLE_AI_API_KEY is not configured");
    _client = new GoogleGenerativeAI(key);
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Non-streaming: returns the full text once the model is done.
// Used by /api/ai/analyze and /api/ai/quiz-generate.
// ---------------------------------------------------------------------------

interface GenerateOptions {
  model?: string;
  system?: string;
  /** Tell Gemini to emit JSON only (skips the ```json fences). */
  jsonMode?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
}

export async function generateContent(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const m = client().getGenerativeModel({
    model: opts.model ?? GEMINI_PRO_MODEL,
    ...(opts.system
      ? { systemInstruction: opts.system }
      : {}),
    generationConfig: {
      ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
      ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
      ...(opts.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  });

  const result = await m.generateContent(prompt);
  return result.response.text();
}

// ---------------------------------------------------------------------------
// Streaming: returns a ReadableStream<Uint8Array> of UTF-8 text chunks.
// Used by /api/ai/coach (Edge runtime).
// ---------------------------------------------------------------------------

interface StreamOptions extends Omit<GenerateOptions, "jsonMode"> {
  /** Called once after the stream completes with the fully accumulated text. */
  onComplete?: (fullText: string) => void | Promise<void>;
}

export async function generateContentStream(
  prompt: string,
  opts: StreamOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  const m = client().getGenerativeModel({
    model: opts.model ?? GEMINI_FLASH_MODEL,
    ...(opts.system ? { systemInstruction: opts.system } : {}),
    generationConfig: {
      ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
      ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
    },
  });

  const result = await m.generateContentStream(prompt);
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      try {
        for await (const chunk of result.stream) {
          const piece = chunk.text();
          if (piece) {
            fullText += piece;
            controller.enqueue(encoder.encode(piece));
          }
        }
        controller.close();
        if (opts.onComplete) {
          try {
            await opts.onComplete(fullText);
          } catch {
            /* swallow — best-effort persistence */
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
