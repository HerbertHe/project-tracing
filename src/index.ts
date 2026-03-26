import { resolve } from "node:path";
import { loadConfig, type TracingTarget } from "./config";
import { runGit } from "./strategies/git";
import { runVersion } from "./strategies/version";
import { writeDailyReport, type TraceEntry } from "./report";

async function runTarget(t: TracingTarget): Promise<TraceEntry> {
  if (t.strategy === "version") {
    return runVersion(t);
  }
  return runGit(t);
}

async function main(): Promise<void> {
  const configArg = process.argv[2];
  const configPath = resolve(configArg ?? "tracing.config.json");
  const distDir = resolve("dist");
  const ranAt = new Date();

  const cfg = await loadConfig(configPath);
  const entries: TraceEntry[] = [];

  for (const t of cfg.targets) {
    entries.push(await runTarget(t));
  }

  const { dateFolder, markdownPath, jsonPath } = await writeDailyReport(
    distDir,
    ranAt,
    entries,
    cfg.resolvedTimeZone,
    cfg.resolvedLanguage
  );
  console.log(`已写入：${markdownPath}`);
  console.log(`已写入：${jsonPath}`);
  console.log(`日期目录：${dateFolder}`);
}

main().catch((e) => {
  console.error((e as Error).message ?? e);
  process.exitCode = 1;
});
