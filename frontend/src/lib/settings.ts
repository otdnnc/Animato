// Gemini AI settings, persisted in localStorage. The chat panel checks these
// on send: when present we hand off to Gemini (wired later); when absent we
// fall back to the manual prompt/run dialog.

export const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.1-pro-preview",
] as const;

export type GeminiModel = (typeof GEMINI_MODELS)[number];

export interface GeminiSettings {
  apiKey: string;
  endpoint: string;
  model: string;
}

const STORAGE_KEY = "gemini-ai-settings";

export const DEFAULT_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta";

export function loadGeminiSettings(): GeminiSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<GeminiSettings>;

    return {
      apiKey: parsed.apiKey ?? "",
      // A blank saved endpoint (the field was cleared) must fall back to the
      // default, not stay "" — `??` keeps "", so use `||` on the trimmed value.
      endpoint: parsed.endpoint?.trim() || DEFAULT_ENDPOINT,
      model: parsed.model ?? GEMINI_MODELS[0],
    };
  } catch {
    return null;
  }
}

export function saveGeminiSettings(settings: GeminiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** True when usable Gemini settings exist (an API key has been saved). */
export function hasGeminiSettings(): boolean {
  const settings = loadGeminiSettings();

  return !!settings && settings.apiKey.trim().length > 0;
}
