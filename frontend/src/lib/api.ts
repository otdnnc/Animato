import type { GeminiSettings } from "@/lib/settings";
import type { UploadedModel } from "@/types/model";

// In dev the FastAPI backend runs separately from the Vite dev server, so
// requests are absolute (cross-origin, allowed via CORS). A production build is
// served BY FastAPI from public/, so it talks to its own origin with relative
// URLs ("" base). Override either with VITE_API_URL (e.g. in .env).
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.PROD ? "" : "http://localhost:8000");

/** Turn a backend-relative path (e.g. /public/upload/x.glb) into an absolute URL. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;

  return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Build a fresh model descriptor from a run/chat output URL. The cache-busting
 * `?t=` query forces three.js to re-fetch a file that was overwritten in place.
 */
export function modelFromOutputUrl(output_url: string): UploadedModel {
  const clean = output_url.split("?")[0];
  const filename = clean.slice(clean.lastIndexOf("/") + 1);

  return {
    filename,
    size: 0,
    url: clean,
    absolute_url: `${absoluteUrl(clean)}?t=${Date.now()}`,
  };
}

export interface PromptResponse {
  /** The prompt text to paste into an AI coding assistant. */
  prompt: string;
  /** Public URL of the model the generated script will overwrite. */
  output_url: string;
}

export interface RunResponse {
  ok: boolean;
  returncode: number;
  stdout: string;
  stderr: string;
  /** Public URL of the model the run produced/overwrote, or null. */
  output_url: string | null;
}

/** /api/chat result: the code Gemini wrote, plus the run outcome (RunResponse). */
export interface ChatResponse extends RunResponse {
  /** The raw bpy script Gemini generated (for display). */
  code: string;
}

/** A prior conversation turn forwarded to Gemini for multi-turn context. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface RemoveAnimationResponse {
  ok: boolean;
  /** Public URL of the model with the clip removed (overwritten in place). */
  output_url: string;
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const data = await res.json();

    if (data && typeof data.detail === "string") return data.detail;
  } catch {
    // Body wasn't JSON; fall back to the status line below.
  }

  return `Request failed (${res.status} ${res.statusText}).`;
}

/** List every model already uploaded under public/upload/. */
export async function listFiles(): Promise<UploadedModel[]> {
  const res = await fetch(`${API_URL}/api/files`);

  if (!res.ok) throw new Error(await errorDetail(res));

  return (await res.json()) as UploadedModel[];
}

/** Upload a 3D model to the backend; it validates, stores, and returns its URL. */
export async function uploadModel(file: File): Promise<UploadedModel> {
  const form = new FormData();

  form.append("file", file);

  const res = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error(await errorDetail(res));

  return (await res.json()) as UploadedModel;
}

/** Build the AI animation prompt for an uploaded model (POST /api/prompt). */
export async function buildPrompt(
  filename: string,
  message: string,
): Promise<PromptResponse> {
  const res = await fetch(`${API_URL}/api/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, message }),
  });

  if (!res.ok) throw new Error(await errorDetail(res));

  return (await res.json()) as PromptResponse;
}

/**
 * Execute AI-generated bpy code on the backend (POST /api/run). Sent as a raw
 * text/plain body — the easy path the backend recommends, since multi-line code
 * needs no JSON escaping. Note: a script that fails returns HTTP 200 with
 * `ok: false`, so callers must inspect `ok`, not just the HTTP status.
 */
export async function runCode(code: string): Promise<RunResponse> {
  const res = await fetch(`${API_URL}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: code,
  });

  if (!res.ok) throw new Error(await errorDetail(res));

  return (await res.json()) as RunResponse;
}

/**
 * Delete a named animation clip from an uploaded model (POST /api/animation/remove).
 * The backend removes it with fixed bpy Python and overwrites the file in place,
 * returning the (unchanged) URL so the viewer can reload the cache-busted file.
 */
export async function removeAnimation(
  filename: string,
  name: string,
): Promise<RemoveAnimationResponse> {
  const res = await fetch(`${API_URL}/api/animation/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, name }),
  });

  if (!res.ok) throw new Error(await errorDetail(res));

  return (await res.json()) as RemoveAnimationResponse;
}

/**
 * Send a chat message to the backend, which builds the prompt for the named
 * upload, runs it through Gemini, and executes the bpy code it returns
 * (POST /api/chat). The user's Gemini credentials live only in the browser, so
 * they're forwarded per-request. Like runCode, a failed script returns HTTP 200
 * with `ok: false`, so inspect `ok` rather than relying on the HTTP status.
 */
export async function chatGenerate(
  settings: GeminiSettings,
  filename: string,
  message: string,
  history: ChatTurn[] = [],
): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: settings.apiKey,
      endpoint: settings.endpoint,
      model: settings.model,
      filename,
      message,
      history,
    }),
  });

  if (!res.ok) throw new Error(await errorDetail(res));

  return (await res.json()) as ChatResponse;
}
