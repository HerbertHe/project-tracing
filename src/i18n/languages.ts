export type Language = "en-US" | "zh-CN" | "fr-FR" | "ja-JP";

export const DEFAULT_LANGUAGE: Language = "en-US";

const SUPPORTED: Language[] = ["en-US", "zh-CN", "fr-FR", "ja-JP"];

export function normalizeLanguage(input: unknown): Language {
  if (typeof input === "string") {
    const v = input.trim();
    if (SUPPORTED.includes(v as Language)) return v as Language;
  }
  return DEFAULT_LANGUAGE;
}
