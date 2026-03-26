import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitTarget {
  strategy: "git";
  name?: string;
  repoUrl: string;
  branch: string;
  basicCommit: string;
}

export interface GitCommitLine {
  hash: string;
  subject: string;
}

export interface GitReport {
  kind: "git";
  name?: string;
  repoUrl: string;
  branch: string;
  basicCommit: string;
  commits: GitCommitLine[];
  hasUpdate: boolean;
  headSha?: string;
  error?: string;
}

interface GitHubParsed {
  owner: string;
  repo: string;
}

function parseGitHubRepo(repoUrl: string): GitHubParsed | null {
  try {
    const normalized = repoUrl.trim().replace(/\.git$/i, "");
    const u = new URL(normalized);
    if (u.hostname !== "github.com") {
      return null;
    }
    const seg = u.pathname.split("/").filter(Boolean);
    if (seg.length < 2) return null;
    return { owner: seg[0], repo: seg[1] };
  } catch {
    return null;
  }
}

interface GitHubCompareCommit {
  sha?: string;
  commit?: { message?: string };
}

async function fetchGitHubCompare(
  parsed: GitHubParsed,
  base: string,
  head: string
): Promise<{ commits: GitCommitLine[]; aheadBy: number }> {
  const path = `repos/${parsed.owner}/${parsed.repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
  const apiUrl = `https://api.github.com/${path}`;
  const res = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "project-tracing",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "follow",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text) as {
    status?: string;
    ahead_by?: number;
    commits?: GitHubCompareCommit[];
  };
  const list = json.commits ?? [];
  const commits: GitCommitLine[] = list.map((c) => {
    const sha = (c.sha ?? "").slice(0, 7);
    const subject = (c.commit?.message ?? "").split("\n")[0] ?? "";
    return { hash: sha, subject };
  });
  const aheadBy = typeof json.ahead_by === "number" ? json.ahead_by : commits.length;
  return { commits, aheadBy };
}

async function gitLogSince(
  repoUrl: string,
  branch: string,
  basicCommit: string
): Promise<{ commits: GitCommitLine[]; headSha: string }> {
  const dir = await mkdtemp(join(tmpdir(), "tracing-git-"));
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

  try {
    await execFileAsync(
      "git",
      ["clone", "--quiet", "--single-branch", "--branch", branch, repoUrl, dir],
      { env, maxBuffer: 64 * 1024 * 1024 }
    );

    await execFileAsync("git", ["rev-parse", "--verify", `${basicCommit}^{commit}`], {
      cwd: dir,
    }).catch(() => {
      throw new Error(`仓库中找不到基准提交: ${basicCommit}（尝试完整 SHA 或先 fetch 深度）`);
    });

    const { stdout: head } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: dir });

    const { stdout: logOut } = await execFileAsync(
      "git",
      ["log", "--pretty=format:%h %s", `${basicCommit}..HEAD`],
      { cwd: dir, maxBuffer: 32 * 1024 * 1024 }
    );

    const lines = logOut.trim().split("\n").filter(Boolean);
    const commits: GitCommitLine[] = lines.map((line: string) => {
      const space = line.indexOf(" ");
      const hash = space === -1 ? line : line.slice(0, space);
      const subject = space === -1 ? "" : line.slice(space + 1);
      return { hash, subject };
    });

    return { commits, headSha: head.trim() };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function runGit(t: GitTarget): Promise<GitReport> {
  const base: Omit<GitReport, "commits" | "hasUpdate" | "headSha" | "error"> = {
    kind: "git",
    name: t.name,
    repoUrl: t.repoUrl,
    branch: t.branch,
    basicCommit: t.basicCommit,
  };

  try {
    const gh = parseGitHubRepo(t.repoUrl);
    if (gh) {
      const { commits } = await fetchGitHubCompare(gh, t.basicCommit, t.branch);
      return {
        ...base,
        commits,
        hasUpdate: commits.length > 0,
      };
    }

    const { commits, headSha } = await gitLogSince(t.repoUrl, t.branch, t.basicCommit);
    return {
      ...base,
      commits,
      hasUpdate: commits.length > 0,
      headSha,
    };
  } catch (e) {
    const err = e as Error;
    return {
      ...base,
      commits: [],
      hasUpdate: false,
      error: err.message,
    };
  }
}
