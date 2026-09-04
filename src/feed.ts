import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const siteUrl = "https://ibert.me/project-tracing";
const feedUrl = `${siteUrl}/feed.xml`;

interface Report {
  generatedAt: { isoUtc: string };
  dateFolder: string;
  entryCount: number;
  entries: Array<{ name?: string; hasUpdate?: boolean; repoUrl?: string; versionUrl?: string }>;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function loadReports(distDir: string): Promise<Report[]> {
  const names = await readdir(distDir, { withFileTypes: true });
  const days = names
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .slice(-3);

  return Promise.all(
    days.map(async (day) => {
      const raw = await readFile(join(distDir, day, "report.json"), "utf8");
      return JSON.parse(raw) as Report;
    })
  );
}

function renderEntry(report: Report): string {
  const date = escapeXml(report.dateFolder);
  const reportUrl = `${siteUrl}/${date}/report.md`;
  const updatedItems = report.entries
    .filter((entry) => entry.hasUpdate)
    .map((entry) => entry.name ?? entry.repoUrl ?? entry.versionUrl ?? "未命名项目")
    .join("、");
  const summary = updatedItems
    ? `检测到以下项目有更新，需要重点关注跟进：${updatedItems}。`
    : `本日共追踪 ${report.entryCount} 个项目，未检测到更新。`;

  return [
    "  <entry>",
    `    <id>${escapeXml(reportUrl)}</id>`,
    `    <title>项目追踪日报 ${date}</title>`,
    `    <updated>${escapeXml(new Date(report.generatedAt.isoUtc).toISOString())}</updated>`,
    `    <link href="${escapeXml(reportUrl)}"/>`,
    `    <summary type="text">${escapeXml(summary)}</summary>`,
    `    <content type="text">${escapeXml(summary)}</content>`,
    "  </entry>",
  ].join("\n");
}

async function main(): Promise<void> {
  const distDir = resolve(process.argv[2] ?? "dist");
  const reports = await loadReports(distDir);
  if (reports.length === 0) throw new Error("没有找到可生成 Atom Feed 的日报。");

  const latestUpdated = new Date(reports.at(-1)!.generatedAt.isoUtc).toISOString();
  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="zh-CN">',
    `  <title>项目追踪日报</title>`,
    `  <id>${escapeXml(siteUrl)}/</id>`,
    `  <updated>${escapeXml(latestUpdated)}</updated>`,
    `  <link rel="self" href="${escapeXml(feedUrl)}"/>`,
    `  <link rel="alternate" href="${escapeXml(siteUrl)}/"/>`,
    ...reports.slice().reverse().map(renderEntry),
    "</feed>",
    "",
  ].join("\n");

  const outputDir = join(distDir, "project-tracing");
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "feed.xml"), xml, "utf8");
  console.log(`已写入 Atom Feed：${join(outputDir, "feed.xml")}`);
}

main().catch((error) => {
  console.error((error as Error).message ?? error);
  process.exitCode = 1;
});
