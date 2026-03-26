import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Language } from "./languages";

type Messages = Record<string, string>;

const cache = new Map<Language, Messages>();

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "locales");

export async function loadMessages(language: Language): Promise<Messages> {
  const cached = cache.get(language);
  if (cached) return cached;

  const filePath = join(localesDir, `${language}.json`);
  const raw = await readFile(filePath, "utf8");
  const data = JSON.parse(raw) as Messages;
  cache.set(language, data);
  return data;
}
