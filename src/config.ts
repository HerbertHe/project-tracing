import { Ajv, type ErrorObject } from "ajv";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ResolvedTimeZone } from "./utils/time-zone";
import { resolveTimeZone } from "./utils/time-zone";
import type { Language } from "./i18n/languages";
import { normalizeLanguage } from "./i18n/languages";
import type { GitTarget } from "./strategies/git";
import type { VersionTarget } from "./strategies/version";

export type TracingTarget = VersionTarget | GitTarget;

/** 与 tracing.config.json 对齐的字段（不含运行时解析结果） */
interface TracingConfigFileShape {
  timeZone?: string;
  language?: string;
  targets: TracingTarget[];
}

export interface TracingConfig extends TracingConfigFileShape {
  /** 由 timeZone 解析得到；用于报告时间与日报文件名日期 */
  resolvedTimeZone: ResolvedTimeZone;
  /** 由 language 解析得到；用于日报国际化渲染 */
  resolvedLanguage: Language;
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors?.length) return "未知校验错误";
  return errors
    .map((e) => {
      const p = e.instancePath || "/";
      return `${p} ${e.message ?? ""}`.trim();
    })
    .join("; ");
}

export async function loadConfig(configPath: string): Promise<TracingConfig> {
  const abs = resolve(configPath);
  const raw = await readFile(abs, "utf8");
  const data = JSON.parse(raw) as unknown;

  const schemaPath = resolve(dirname(abs), "scheme.json");
  const schemaRaw = await readFile(schemaPath, "utf8");
  const schema = JSON.parse(schemaRaw) as object;

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(data)) {
    throw new Error(`tracing.config.json 不符合 scheme.json：${formatAjvErrors(validate.errors)}`);
  }

  const file = data as TracingConfigFileShape;
  return {
    targets: file.targets,
    timeZone: file.timeZone,
    resolvedTimeZone: resolveTimeZone(file.timeZone),
    resolvedLanguage: normalizeLanguage(file.language),
  };
}
