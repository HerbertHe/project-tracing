/**
 * 将 npm 风格版本号归一化为可用于逐段比较大小的数字数组。
 * 规则：去掉前导 v/V；截取第一个 `-` 之前为核心版本；按 `.` 拆分，每段取前导十进制数字部分。
 */

function coreSegments(raw: string): number[] {
  let s = raw.trim();
  if (s.startsWith("v") || s.startsWith("V")) {
    s = s.slice(1).trim();
  }
  const core = s.split("-")[0] ?? s;
  const parts = core.split(".").filter((p) => p.length > 0);
  return parts.map((p) => {
    const m = /^(\d+)/.exec(p);
    return m ? parseInt(m[1], 10) : 0;
  });
}

export function compareVersions(a: string, b: string): number {
  const sa = coreSegments(a);
  const sb = coreSegments(b);
  const n = Math.max(sa.length, sb.length);
  for (let i = 0; i < n; i++) {
    const da = sa[i] ?? 0;
    const db = sb[i] ?? 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

export function isNewerVersion(remote: string, basic: string): boolean {
  return compareVersions(remote, basic) > 0;
}
