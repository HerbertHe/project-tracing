import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GitReport } from "./strategies/git";
import type { VersionReport } from "./strategies/version";
import type { ResolvedTimeZone } from "./utils/time-zone";
import { formatTimeZoneConfigLabel, formatZonedDateTime, getYmdInZone } from "./utils/time-zone";
import type { Language } from "./i18n/languages";
import { loadMessages } from "./i18n/load";

export type TraceEntry = VersionReport | GitReport;

type Messages = Record<string, string>;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function todayFilenamePrefix(date: Date, tz: ResolvedTimeZone): string {
  const { y, m, d } = getYmdInZone(date, tz);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function msg(messages: Messages, key: string): string {
  return messages[key] ?? key;
}

/** 表格单元格：避免打断管道与换行 */
function cell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim() || "—";
}

function row(key: string, value: string): string {
  return `| ${cell(key)} | ${cell(value)} |`;
}

function tableHeader(itemLabel: string, contentLabel: string): string {
  return [`| ${cell(itemLabel)} | ${cell(contentLabel)} |`, `| --- | --- |`].join("\n");
}

function renderVersion(r: VersionReport, index: number, messages: Messages): string {
  const itemLabel = msg(messages, "table.item");
  const contentLabel = msg(messages, "table.content");

  const title = r.name
    ? `### ${index}. ${r.name}${msg(messages, "title.versionWithNameSuffix")}`
    : `### ${index}. ${msg(messages, "title.versionTracking")}`;

  const compareLabel =
    r.compareResult === "newer"
      ? msg(messages, "version.compare.higher")
      : r.compareResult === "older"
        ? msg(messages, "version.compare.lower")
        : msg(messages, "version.compare.same");

  const lines: string[] = [
    title,
    "",
    tableHeader(itemLabel, contentLabel),
    row(msg(messages, "labels.strategy"), msg(messages, "strategy.versionSubscription")),
    row(msg(messages, "version.subscriptionUrl"), r.versionUrl),
    row(msg(messages, "version.baselineVersion"), r.basicVersion),
    row(msg(messages, "version.remoteVersion"), r.remoteVersion || "—"),
    row(msg(messages, "version.compareResult"), compareLabel),
    row(
      msg(messages, "version.updateHigher"),
      r.hasUpdate ? msg(messages, "common.yes") : msg(messages, "common.no")
    ),
  ];

  if (r.error) {
    lines.push(row(msg(messages, "labels.error"), r.error));
  }

  lines.push("");
  return lines.join("\n");
}

function renderGit(r: GitReport, index: number, messages: Messages): string {
  const itemLabel = msg(messages, "table.item");
  const contentLabel = msg(messages, "table.content");

  const title = r.name
    ? `### ${index}. ${r.name}${msg(messages, "title.gitWithNameSuffix")}`
    : `### ${index}. ${msg(messages, "title.gitTracking")}`;

  const lines: string[] = [
    title,
    "",
    tableHeader(itemLabel, contentLabel),
    row(msg(messages, "labels.strategy"), msg(messages, "strategy.gitTracking")),
    row(msg(messages, "git.repo"), r.repoUrl),
    row(msg(messages, "git.branch"), r.branch),
    row(msg(messages, "git.baselineCommit"), r.basicCommit),
  ];

  if (r.headSha) {
    lines.push(row(msg(messages, "git.currentHead"), r.headSha));
  }

  lines.push(
    row(
      msg(messages, "git.hasNewCommits"),
      r.hasUpdate ? msg(messages, "common.yes") : msg(messages, "common.no")
    ),
    row(msg(messages, "git.newCommitsCount"), String(r.commits.length))
  );

  if (r.error) {
    lines.push(row(msg(messages, "labels.error"), r.error));
  }

  lines.push("");

  if (r.commits.length > 0) {
    const hashLabel = msg(messages, "table.hash");
    const descLabel = msg(messages, "table.description");
    lines.push(
      `**${msg(messages, "git.commitListTitle")}**`,
      "",
      `| ${cell(hashLabel)} | ${cell(descLabel)} |`,
      `| --- | --- |`
    );
    for (const c of r.commits) {
      lines.push(`| \`${cell(c.hash)}\` | ${cell(c.subject)} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildMarkdown(ranAt: Date, entries: TraceEntry[], tz: ResolvedTimeZone, messages: Messages): string {
  const zoned = formatZonedDateTime(ranAt, tz);
  const tzLabel = formatTimeZoneConfigLabel(tz);
  const prefix = msg(messages, "report.titlePrefix");
  const title = `# ${prefix}`;

  const overviewHeading = msg(messages, "heading.overview");
  const detailsHeading = msg(messages, "heading.details");
  const noTargets = msg(messages, "text.noTargets");

  const head = [
    title,
    "",
    `## ${overviewHeading}`,
    "",
    tableHeader(msg(messages, "table.item"), msg(messages, "table.content")),
    row(msg(messages, "labels.generatedTime"), zoned),
    row(msg(messages, "labels.timeZone"), tzLabel),
    row(msg(messages, "labels.entryCount"), String(entries.length)),
    "",
  ];

  if (entries.length === 0) {
    head.push(`## ${detailsHeading}`, "", noTargets, "");
    return head.join("\n");
  }

  const body = entries.map((e, i) => {
    const n = i + 1;
    return e.kind === "version" ? renderVersion(e, n, messages) : renderGit(e, n, messages);
  });

  return [...head, `## ${detailsHeading}`, "", ...body].join("\n");
}

function serializeTimeZone(tz: ResolvedTimeZone): Record<string, unknown> {
  if (tz.kind === "iana") return { kind: "iana", id: tz.id };
  return { kind: "offset", minutes: tz.minutes, label: tz.label };
}

export interface TraceReportJson {
  reportVersion: 1;
  generatedAt: { isoUtc: string; zoned: string };
  dateFolder: string;
  timeZone: Record<string, unknown>;
  timeZoneLabel: string;
  language: Language;
  entryCount: number;
  entries: TraceEntry[];
}

export interface WriteReportResult {
  dateFolder: string;
  markdownPath: string;
  jsonPath: string;
}

export async function writeDailyReport(
  distDir: string,
  ranAt: Date,
  entries: TraceEntry[],
  tz: ResolvedTimeZone,
  language: Language
): Promise<WriteReportResult> {
  const messages = await loadMessages(language);

  const dateFolder = todayFilenamePrefix(ranAt, tz);
  const dayDir = join(distDir, dateFolder);
  await mkdir(dayDir, { recursive: true });

  const markdownPath = join(dayDir, "report.md");
  const jsonPath = join(dayDir, "report.json");

  const md = buildMarkdown(ranAt, entries, tz, messages);
  await writeFile(markdownPath, md, "utf8");

  const payload: TraceReportJson = {
    reportVersion: 1,
    generatedAt: {
      isoUtc: ranAt.toISOString(),
      zoned: formatZonedDateTime(ranAt, tz),
    },
    dateFolder,
    timeZone: serializeTimeZone(tz),
    timeZoneLabel: formatTimeZoneConfigLabel(tz),
    language,
    entryCount: entries.length,
    entries,
  };
  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return { dateFolder, markdownPath, jsonPath };
}

