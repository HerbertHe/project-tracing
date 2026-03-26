import { getByPath } from "../utils/json-field";
import { compareVersions, isNewerVersion } from "../utils/version-compare";

export interface VersionTarget {
  strategy: "version";
  name?: string;
  versionUrl: string;
  versionSource: "plain" | "json";
  versionField?: string;
  basicVersion: string;
}

export interface VersionReport {
  kind: "version";
  name?: string;
  versionUrl: string;
  basicVersion: string;
  remoteRaw: string;
  remoteVersion: string;
  compareResult: "newer" | "same" | "older";
  hasUpdate: boolean;
  error?: string;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

function extractVersionFromJson(body: string, field: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch (e) {
    throw new Error(`JSON 解析失败: ${(e as Error).message}`);
  }
  const v = getByPath(parsed, field);
  if (v === undefined || v === null) {
    throw new Error(`字段 ${field} 不存在或为空`);
  }
  if (typeof v !== "string" && typeof v !== "number") {
    throw new Error(`字段 ${field} 类型须为 string 或 number`);
  }
  return String(v).trim();
}

export async function runVersion(t: VersionTarget): Promise<VersionReport> {
  const base: Omit<VersionReport, "remoteRaw" | "remoteVersion" | "compareResult" | "hasUpdate" | "error"> = {
    kind: "version",
    name: t.name,
    versionUrl: t.versionUrl,
    basicVersion: t.basicVersion,
  };

  try {
    const text = await fetchText(t.versionUrl);
    let remoteVersion: string;
    if (t.versionSource === "plain") {
      remoteVersion = text.trim();
    } else {
      const field = t.versionField;
      if (!field) {
        throw new Error("versionSource 为 json 时必须提供 versionField");
      }
      remoteVersion = extractVersionFromJson(text, field);
    }

    const cmp = compareVersions(remoteVersion, t.basicVersion);
    const compareResult: VersionReport["compareResult"] =
      cmp > 0 ? "newer" : cmp < 0 ? "older" : "same";

    return {
      ...base,
      remoteRaw:
        t.versionSource === "plain"
          ? text.trim().slice(0, 500)
          : remoteVersion,
      remoteVersion,
      compareResult,
      hasUpdate: isNewerVersion(remoteVersion, t.basicVersion),
    };
  } catch (e) {
    const err = e as Error;
    return {
      ...base,
      remoteRaw: "",
      remoteVersion: "",
      compareResult: "same",
      hasUpdate: false,
      error: err.message,
    };
  }
}
