/**
 * 报告与文件名的时区：默认 Asia/Shanghai（UTC+8）。
 * 支持 IANA（如 Asia/Tokyo）或固定偏移（如 +08:00、UTC+8、-05:30）。
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export type ResolvedTimeZone =
  | { kind: "iana"; id: string }
  | { kind: "offset"; minutes: number; label: string };

/** 未配置 timeZone 时使用（UTC+8） */
export const DEFAULT_TIME_ZONE = "Asia/Shanghai";

function offsetLabel(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${pad2(h)}:${pad2(m)}`;
}

function parseFixedOffsetMinutes(raw: string): number | null {
  let s = raw.trim();
  const utcStripped = /^UTC\s*([+-].*)$/i.exec(s);
  if (utcStripped) s = utcStripped[1].trim();

  const m = /^([+-])(\d{1,2})(?::(\d{2}))?$/.exec(s);
  if (!m) return null;
  const sign = m[1] === "+" ? 1 : -1;
  const h = parseInt(m[2], 10);
  const min = m[3] !== undefined ? parseInt(m[3], 10) : 0;
  if (min < 0 || min >= 60 || h > 14) return null;
  return sign * (h * 60 + min);
}

function assertValidIana(timeZoneId: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timeZoneId }).format(new Date());
  } catch {
    throw new Error(
      `无效 timeZone: ${timeZoneId}（使用 IANA 如 Asia/Shanghai，或固定偏移如 +08:00 / UTC+8）`
    );
  }
}

/**
 * 解析配置中的 timeZone；未传或空字符串时使用 DEFAULT_TIME_ZONE。
 */
export function resolveTimeZone(input: string | undefined): ResolvedTimeZone {
  const raw = input?.trim() ?? "";
  if (!raw) {
    return { kind: "iana", id: DEFAULT_TIME_ZONE };
  }

  const off = parseFixedOffsetMinutes(raw);
  if (off !== null) {
    return { kind: "offset", minutes: off, label: offsetLabel(off) };
  }

  assertValidIana(raw);
  return { kind: "iana", id: raw };
}

/** 配置项展示用（表格「时区」列） */
export function formatTimeZoneConfigLabel(tz: ResolvedTimeZone): string {
  if (tz.kind === "offset") return tz.label;
  return tz.id;
}

export function getYmdInZone(date: Date, tz: ResolvedTimeZone): { y: number; m: number; d: number } {
  if (tz.kind === "offset") {
    const ms = date.getTime() + tz.minutes * 60 * 1000;
    const u = new Date(ms);
    return { y: u.getUTCFullYear(), m: u.getUTCMonth() + 1, d: u.getUTCDate() };
  }
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz.id,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const y = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const d = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  return { y, m, d };
}

export function formatZonedDateTime(date: Date, tz: ResolvedTimeZone): string {
  if (tz.kind === "offset") {
    const ms = date.getTime() + tz.minutes * 60 * 1000;
    const u = new Date(ms);
    return `${u.getUTCFullYear()}-${pad2(u.getUTCMonth() + 1)}-${pad2(u.getUTCDate())} ${pad2(u.getUTCHours())}:${pad2(u.getUTCMinutes())}:${pad2(u.getUTCSeconds())} (${tz.label})`;
  }
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz.id,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${fmt.format(date)} (${tz.id})`;
}
