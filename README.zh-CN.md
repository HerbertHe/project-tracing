# project-tracing

[English](./README.md)

用于跟踪你关心的外部项目：把**远端版本**与基准版本对比，或列出某个**基准提交**之后的 **Git** 提交记录。配置会经 `scheme.json` 校验。报告输出在 `dist/<yyyy-mm-dd>/` 下，包含 **`report.md`** 与 **`report.json`**（日期目录按你配置的时区计算日历日）。

## 环境要求

- **Node.js** ≥ 20（使用 `fetch`、`import.meta.url` 等）
- **pnpm**（或可改用 `npx tsx` 等价方式）

对于非 `github.com` 的 Git 目标，需要在 `PATH` 上可用 **`git`** 命令。

## 安装

```bash
pnpm install
```

## 使用

```bash
pnpm trace
```

可选：指定配置文件路径：

```bash
pnpm trace /path/to/tracing.config.json
```

输出示例：

- `dist/2026-03-26/report.md` — Markdown 表格；固定界面文案来自 `src/i18n/locales/*.json`
- `dist/2026-03-26/report.json` — 机器可读数据（`entries`、时间戳、解析后的时区、`language` 等）

## 配置说明

| 文件 | 作用 |
| --- | --- |
| `tracing.config.json` | 追踪目标列表，可选 `timeZone`、`language` |
| `scheme.json` | 对配置文件的 JSON Schema 约束 |

### 示例配置

仓库提供了 `tracing.example.config.json` 作为起步示例。

使用时请将其复制/覆盖为 `tracing.config.json`，然后按需修改 `targets`（以及可选的 `timeZone` / `language`）。

### `language`

取值为 `en-US`（默认）、`zh-CN`、`fr-FR`、`ja-JP`。省略或非法值会回退到 `en-US`。

### `timeZone`

IANA 时区（如 `Asia/Shanghai`）或固定偏移（如 `+08:00`、`UTC+8`）。省略时默认为 **`Asia/Shanghai`**（UTC+8）。**`yyyy-mm-dd`** 报告目录名使用该时区下的日历日期。

### 策略

**版本（version）** — 对 `versionUrl` 发起 `GET`。`versionSource` 为 `plain`（响应体即版本字符串）或 `json`，后者需配合 `versionField`（支持点路径与 `[下标]`，例如 `a.b[0].c`）。

**Git（git）** — 对 `github.com` 仓库使用 GitHub Compare API；其它地址则用 `git clone` 并执行 `git log <basicCommit>..HEAD`。

## 类型检查

```bash
pnpm typecheck
```

## 许可

LICENSE MIT &copy; Herbert He
