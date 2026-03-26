# project-tracing

[简体中文](./README.zh-CN.md).

Track external projects you care about: compare a **remote version** to a baseline, or list **Git commits** after a baseline SHA. Configuration is validated against `scheme.json`. Reports are written under `dist/<yyyy-mm-dd>/` as **`report.md`** and **`report.json`** (date folder uses your configured time zone).

## Requirements

- **Node.js** ≥ 20 (uses `fetch`, `import.meta.url`, etc.)
- **pnpm** (or use `npx tsx` equivalently)

For non–`github.com` Git targets, the **`git`** CLI must be available on `PATH`.

## Install

```bash
pnpm install
```

## Usage

```bash
pnpm trace
```

Optional config path:

```bash
pnpm trace /path/to/tracing.config.json
```

Outputs (example):

- `dist/2026-03-26/report.md` — Markdown tables; fixed UI strings come from `src/i18n/locales/*.json`
- `dist/2026-03-26/report.json` — machine-readable payload (`entries`, timestamps, resolved time zone, language)

## Configuration

| File | Role |
| --- | --- |
| `tracing.config.json` | Your targets, optional `timeZone`, optional `language` |
| `scheme.json` | JSON Schema constraints for the config file |

### Example config

This repository includes `tracing.example.config.json` as a starting point.

To use it, copy/replace it with `tracing.config.json`, then edit the `targets` (and optionally `timeZone` / `language`).

### `language`

One of `en-US` (default), `zh-CN`, `fr-FR`, `ja-JP`. Omitted or invalid values fall back to `en-US`.

### `timeZone`

IANA ID (e.g. `Asia/Shanghai`) or fixed offset (`+08:00`, `UTC+8`). Omitted defaults to **`Asia/Shanghai`** (UTC+8). The **`yyyy-mm-dd`** report folder name uses this zone’s calendar date.

### Strategies

**Version** — `GET` `versionUrl`. `versionSource` is `plain` (body is the version string) or `json` with `versionField` (dot path and `[index]` segments supported, e.g. `a.b[0].c`).

**Git** — For `github.com` repos, uses the GitHub compare API; otherwise clones with `git` and runs `git log <basicCommit>..HEAD`.

## Typecheck

```bash
pnpm typecheck
```

## License

LICENSE MIT &copy; Herbert He
