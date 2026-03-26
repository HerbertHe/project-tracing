/**
 * 从对象/数组中按路径取值。支持：
 * - 点分段：`a.b.c`
 * - 数组下标：`a.b[0].c`、`items[0].version`、`list[1][2].x`
 * 下标须为非负整数字面量（含前导 0 的十进制）。
 */

function parsePathSegments(path: string): (string | number)[] {
  const s = path.trim();
  if (!s) throw new Error("versionField 路径不能为空");

  const segments: (string | number)[] = [];
  let i = 0;
  const n = s.length;

  const skipSeparators = () => {
    while (i < n && (s[i] === "." || /\s/.test(s[i]))) i++;
  };

  while (i < n) {
    skipSeparators();
    if (i >= n) break;

    if (s[i] === "[") {
      i++;
      const start = i;
      while (i < n && s[i] >= "0" && s[i] <= "9") i++;
      if (start === i || s[i] !== "]") {
        throw new Error(
          `versionField 中下标须为非负整数，例如 [0]，在位置 ${i} 附近语法无效`
        );
      }
      const idx = parseInt(s.slice(start, i), 10);
      i++;
      segments.push(idx);
      continue;
    }

    const start = i;
    while (i < n && s[i] !== "." && s[i] !== "[" && !/\s/.test(s[i])) i++;
    const key = s.slice(start, i).trim();
    if (!key) {
      throw new Error(`versionField 在位置 ${i} 附近包含空的路径段`);
    }
    segments.push(key);
  }

  if (segments.length === 0) {
    throw new Error("versionField 路径不能为空");
  }

  return segments;
}

export function getByPath(obj: unknown, path: string): unknown {
  const segments = parsePathSegments(path);
  let cur: unknown = obj;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof seg === "number") {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[seg];
    } else {
      if (typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
  }
  return cur;
}
