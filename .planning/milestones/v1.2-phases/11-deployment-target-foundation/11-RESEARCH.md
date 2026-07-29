# Phase 11: Deployment Target Foundation - Research

**Researched:** 2026-07-14
**Domain:** Cloudflare target profile model, local env projection, fail-closed preflight, Wrangler local auth vs CI identity
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

Source for this section: `.planning/phases/11-deployment-target-foundation/11-CONTEXT.md` [VERIFIED: codebase]

### Locked Decisions

## Implementation Decisions

### Deployment Target Model
- **D-01:** `TargetProfile` 的粒度锁定为“一个 profile = 一个可部署目标”，不得再靠 account overlay、domain overlay 或资源推导去拼半套目标身份。
- **D-02:** profile 必须显式记录每类关键资源的稳定身份信息：名称、ID 或 route pattern、canonical URL，以及 required-secret metadata。
- **D-03:** `profile.urls` 必须显式列出每个对外 surface 的 canonical URL，至少覆盖 gateway、api、dashboard、auth、blog、movie、comic、tavern，不允许只记 root domain 再隐式推导。
- **D-04:** required-secret metadata 只记录 secret 名称、必填/选填、消费者；profile 永远不存真实 secret 值。

### Local Env Projection
- **D-05:** 选中 profile 后，本地命令要直接生成现有运行时最终消费文件，而不是引入额外中间层。
- **D-06:** 目标文件以当前 repo 既有消费面为准：`apps/api/.dev.vars`、`apps/gateway/.dev.vars`、root `.env.local`、`packages/crawler/.env`。
- **D-07:** 生成器只管理 target-managed 键；真正的本地敏感值继续由操作者维护，生成器最多保留空洞或占位，不伪装成“已可运行”。
- **D-08:** 切换 profile 时，只更新 target-managed 键，并清理旧的 target-managed 残留；用户自填 secrets 与非 target-managed 本地值必须原样保留。

### Fail-Closed Validation
- **D-09:** preflight 采用 hard fail-closed：任何 target identity 不一致都直接阻断，不保留“warning 但继续”的捷径。
- **D-10:** 校验范围必须同时覆盖 profile 本身、投影结果和命令输入，避免“profile 正确但落地文件还是旧 target”的半切换状态。
- **D-11:** 未显式纳入 selected profile 的 legacy alias、fallback、旧域名默认值一律视为阻断项，不允许通过“最终解析凑巧一致”侥幸放行。
- **D-12:** 对 deploy、migrate、rollback、remote crawl/smoke 这类高风险远程命令，preflight 必须要求 live 资源存在性校验；缺少可用凭证时直接阻断。

### Local Wrangler vs CI Identity Boundary
- **D-13:** 本地 Cloudflare 身份只允许通过 Wrangler auth profile 选择；CI 只允许通过 token/account-secret + GitHub environment / secret bundle 选择，严禁混用。
- **D-14:** 每个 `TargetProfile` 必须显式声明期望的本地 Wrangler profile 名称；当前本地身份与之不匹配时直接阻断。
- **D-15:** 每个 `TargetProfile` 必须显式映射到一个 GitHub environment 或等价 secret bundle；workflow 只能按该映射取 secrets，不允许手工覆盖 secret 来源。
- **D-16:** 所有本地命令和 GitHub workflows 都必须显式给出 selected target；不存在隐式 default target。

### the agent's Discretion
- profile 的文件格式（例如 JSON、TS module、YAML）与命令命名可由 planner 按 repo 现有脚本生态选择，只要字段契约、显式 target 语义和 fail-closed 行为不被削弱。
- target-managed 键在生成文件中的标记方式、占位注释格式、以及“哪些键属于 target-managed” 的内部表示可由 planner 选最稳妥的实现。
- live 校验具体通过哪组 Cloudflare API / Wrangler 子命令完成，由 planner 按当前 CLI 能力和可测试性决定。

### Deferred Ideas (OUT OF SCOPE)

## Deferred Ideas

- Phase 12：让 Workers、Pages、GitHub deploy/migrate/crawl/rollback workflows 实际消费 selected target。
- Phase 13：把 selected target 跑通 local + production full-chain smoke，并记录可重复 evidence。
- Phase 14：旧域名字面量清理、RUNBOOK 定稿、requirement-to-evidence 总核验。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROF-01 | Operator can define a non-secret Cloudflare target profile with account, domain, Workers, Pages, D1, R2, KV, URLs, and required-secret metadata. | Use a typed `TargetProfile` schema in `@starye/config` with explicit resource and URL fields; current resource fields were reverse-mapped from `apps/api/wrangler.toml`, `apps/gateway/wrangler.toml`, `apps/dashboard/wrangler.toml`, and workflows. [VERIFIED: codebase] |
| PROF-02 | Operator can validate a target profile before deploy, migration, crawl, or smoke commands run. | Add a static + projection + command-input preflight, and define live checks for high-risk remote commands using read-style Wrangler commands such as D1 info/list, R2 bucket info/list, and KV namespace list. [CITED: https://developers.cloudflare.com/d1/wrangler-commands/] [CITED: https://developers.cloudflare.com/r2/reference/wrangler-commands/] [CITED: https://developers.cloudflare.com/kv/reference/kv-commands/] |
| PROF-03 | Operator gets fail-closed errors when account, domain, resource IDs, bucket names, or required secrets are missing or inconsistent. | Use Valibot `strictObject`/`safeParse` style validation plus cross-field checks; Valibot supports object schemas and `safeParse` returning structured issues. [CITED: https://valibot.dev/guides/objects/] [CITED: https://valibot.dev/guides/parse-data/] |
| PROF-04 | Operator can use Wrangler auth profiles for local account switching while CI remains token/account-secret based. | Wrangler profiles are local-machine convenience, `CLOUDFLARE_API_TOKEN` overrides profiles, and CI uses `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/] [CITED: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/] |
| ENV-01 | Operator can define local env values once and project them into Worker `.dev.vars`, Vite `.env`, Nuxt runtime config, and crawler env files. | Generate only target-managed keys into `apps/api/.dev.vars`, `apps/gateway/.dev.vars`, root `.env.local`, and `packages/crawler/.env`; these are the locked target files in D-06 and currently exist locally. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] [VERIFIED: codebase] |
| ENV-02 | Operator can validate local env completeness before starting the full local stack. | Projection validation should compare selected profile to existing local env files and check required-secret presence by key only, not value logging. Current key inventory shows API, gateway, root, and crawler files already contain target-sensitive keys. [VERIFIED: codebase] |
| TEST-02 | Automated tests cover target profile validation and fail-closed mismatch cases. | Add focused Vitest tests around profile schema, resolver, projection merger, legacy alias blocking, missing secrets, and selected-target command input; Vitest is the repo's existing test framework. [VERIFIED: package.json] [VERIFIED: rg --files] |
</phase_requirements>

## Summary

Phase 11 should create one small target-profile foundation, not start rewriting deploy/runtime behavior. The primary recommendation is to put a typed, non-secret `TargetProfile` contract and resolver under `packages/config/src/deployment-target/`, expose a thin `tsx` CLI for validation/projection, and keep actual deploy workflow consumption for Phase 12. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] [VERIFIED: packages/config/package.json] [VERIFIED: package.json]

The existing repo already exposes all current singleton target identity surfaces: API Worker name/D1/R2/KV/API route in `apps/api/wrangler.toml`, gateway origins/routes/dev port in `apps/gateway/wrangler.toml`, dashboard Pages public API URL in `apps/dashboard/wrangler.toml`, Nuxt public runtime fallback in `apps/auth/nuxt.config.ts` and `apps/blog/nuxt.config.ts`, crawler env validation in `packages/crawler/scripts/check-config.ts`, and GitHub workflows that still use repo-level `secrets.*`. [VERIFIED: codebase]

**Primary recommendation:** Use a strict TypeScript + Valibot target-profile module in `@starye/config`; add validation/projection commands that fail closed; do not add new external packages or change actual deploy workflow target consumption in Phase 11. [VERIFIED: codebase] [CITED: https://valibot.dev/guides/objects/]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Target profile schema and resolver | Shared Tooling / Config Package | API / Gateway / Frontend / Crawler as consumers | A profile is cross-runtime identity metadata and should be owned outside any one app; `packages/config` already exists as a shared private package. [VERIFIED: packages/config/package.json] |
| Local env projection | Shared Tooling / CLI | Worker local dev, Vite/Nuxt, crawler | D-05 requires writing final consumer files directly, while D-08 requires preserving user-managed secrets. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |
| Fail-closed static/projection validation | Shared Tooling / CLI | CI workflow validation later | The same resolver should validate profile shape, projected files, and selected command target before any remote mutation. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |
| Live Cloudflare resource existence check | Tooling invoking Wrangler | Cloudflare control plane | D-12 requires live checks for deploy/migrate/rollback/remote crawl/smoke; Wrangler exposes read-style commands for D1/R2/KV. [CITED: https://developers.cloudflare.com/d1/wrangler-commands/] [CITED: https://developers.cloudflare.com/r2/reference/wrangler-commands/] [CITED: https://developers.cloudflare.com/kv/reference/kv-commands/] |
| Browser-facing canonical local URL | Gateway | Frontend apps | AGENTS locks local canonical access to `http://localhost:8080/...`; `.env.example` already sets public API env to `http://localhost:8080`. [VERIFIED: AGENTS.md] [VERIFIED: .env.example] |
| CI target identity | GitHub Actions environment / secret bundle | Target profile metadata | Wrangler profiles are local-only; CI authenticates with token/account secrets. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/] [CITED: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/] |

## Project Constraints (from AGENTS.md)

- Default communication, analysis, validation, and delivery should be Chinese. [VERIFIED: AGENTS.md]
- Phase work should follow GSD workflow; this artifact is Phase 11 research only. [VERIFIED: AGENTS.md]
- If docs conflict, active `.planning/*` constraints win during execution. [VERIFIED: AGENTS.md]
- Local validation canonical URL is `http://localhost:8080/...`; direct ports `3000/3001/3002/3003/5173` must not be documented as canonical URLs. [VERIFIED: AGENTS.md]
- Documentation changes should update the canonical owner only and avoid duplicating the same guidance across root docs. [VERIFIED: AGENTS.md]
- Dirty worktree safety is mandatory; do not revert, overwrite, or stage unrelated changes. [VERIFIED: AGENTS.md]
- Symbol edits require GitNexus impact analysis before implementation, and HIGH/CRITICAL blast radius must be announced before proceeding. [VERIFIED: AGENTS.md]
- Before commit, run GitNexus detect-changes to confirm expected symbol/execution-flow impact. [VERIFIED: AGENTS.md]

## Standard Stack

### Core

| Library / Surface | Version | Purpose | Why Standard |
|-------------------|---------|---------|--------------|
| `@starye/config` workspace package | `0.0.0` private | Home for target profile schema/resolver/projection helpers | It already exists as the repo's shared config boundary and avoids creating a new package namespace for a cross-runtime contract. [VERIFIED: packages/config/package.json] |
| TypeScript | repo `^6.0.2` | Strict typed contract and discriminated validation errors | Root `tsconfig.json` enables `strict`, path aliases, and `resolveJsonModule`; current repo policy prefers precise types over `any`. [VERIFIED: tsconfig.json] [VERIFIED: AGENTS.md] |
| Valibot | repo `^1.3.1`; npm latest `1.4.2`, modified 2026-06-28 | Runtime schema validation for unknown profile data and cross-field checks | Valibot is already used in repo packages and official docs support object schemas plus `safeParse`. [VERIFIED: package.json] [CITED: https://valibot.dev/guides/objects/] [CITED: https://valibot.dev/guides/parse-data/] |
| Wrangler | repo `^4.90.0`; npm latest `4.110.0`, modified 2026-07-09 | Cloudflare local auth profile inspection and D1/R2/KV read checks | The repo already uses Wrangler 4, and official docs describe profiles, config, secrets, D1/R2/KV commands. [VERIFIED: package.json] [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/] |
| Vitest | repo `^4.1.4`; npm latest `4.1.10`, modified 2026-07-06 | Unit tests for schema, resolver, projection, preflight failures | Existing apps/packages use Vitest widely and `packages/config/vitest-base.ts` provides a Node test baseline. [VERIFIED: rg --files] [VERIFIED: packages/config/vitest-base.ts] |

### Supporting

| Library / Surface | Version | Purpose | When to Use |
|-------------------|---------|---------|-------------|
| `tsx` | repo `^4.21.0`; npm latest `4.23.1`, modified 2026-07-13 | Run TypeScript CLI scripts without build output | Use for a thin `scripts/target-profile.ts` wrapper, matching crawler script style. [VERIFIED: packages/crawler/package.json] |
| `dotenv` | repo `^17.4.2`; npm latest `17.4.2`, modified 2026-04-12 | Parse dotenv-style local env files | Use for reading local env values; writer still needs marker-aware preservation of user-managed lines. [VERIFIED: packages/crawler/package.json] [CITED: https://developers.cloudflare.com/workers/configuration/environment-variables/] |
| PowerShell wrapper | pwsh `7.6.1` available | Optional bridge from `scripts/pre-deploy-check.ps1` to target preflight | Existing local deploy checks are PowerShell, but target logic should remain in TypeScript for testability. [VERIFIED: environment audit] [VERIFIED: scripts/pre-deploy-check.ps1] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TS module profiles in `@starye/config` | JSON or YAML profile files | JSON is portable but needs a separate loader/validator and loses local type inference; YAML would require a new parser dependency. [ASSUMED] |
| Valibot schema | Zod | Zod exists in repo via Drizzle integrations, but Valibot is already used in API validation paths and avoids adding another schema convention to this phase. [VERIFIED: package.json] |
| Typed CLI in `tsx` | PowerShell-only implementation | PowerShell matches existing scripts but would make schema/projection tests harder and increase Windows-specific parsing risk. [VERIFIED: scripts/pre-deploy-check.ps1] [ASSUMED] |
| Wrangler `env` overlays | One explicit profile object | D-01 forbids overlay composition; Wrangler envs can be consumed later, but Phase 11 must define the non-overlay target source first. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |

**Installation:**

```bash
# No new external package install is recommended for Phase 11.
pnpm install
```

**Version verification:** `npm view wrangler valibot vitest tsx dotenv version time.modified repository.url scripts.postinstall --json` was run on 2026-07-14; no `scripts.postinstall` field was returned for the checked packages. [VERIFIED: npm registry]

## Package Legitimacy Audit

Phase 11 should not install new external packages. The package-legitimacy seam timed out twice while checking `wrangler`, `valibot`, `vitest`, `tsx`, and `dotenv`, so this audit is not used to approve new package additions. [VERIFIED: tool output]

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `wrangler` | npm | Existing repo devDependency | Not queried | `github.com/cloudflare/workers-sdk` | Seam timeout; npm registry exists | Use existing lockfile only; do not upgrade in Phase 11. [VERIFIED: package.json] [VERIFIED: npm registry] |
| `valibot` | npm | Existing repo dependency | Not queried | `github.com/open-circle/valibot` | Seam timeout; npm registry exists | Use existing lockfile only; do not upgrade in Phase 11. [VERIFIED: package.json] [VERIFIED: npm registry] |
| `vitest` | npm | Existing repo devDependency | Not queried | `github.com/vitest-dev/vitest` | Seam timeout; npm registry exists | Use existing lockfile only; do not upgrade in Phase 11. [VERIFIED: package.json] [VERIFIED: npm registry] |
| `tsx` | npm | Existing repo devDependency in crawler | Not queried | `github.com/privatenumber/tsx` | Seam timeout; npm registry exists | Use existing lockfile only; do not upgrade in Phase 11. [VERIFIED: packages/crawler/package.json] [VERIFIED: npm registry] |
| `dotenv` | npm | Existing repo dependency in crawler | Not queried | `github.com/motdotla/dotenv` | Seam timeout; npm registry exists | Use existing lockfile only; if adding as `@starye/config` dependency, planner should add a human checkpoint because legitimacy seam did not return `OK`. [VERIFIED: packages/crawler/package.json] [VERIFIED: npm registry] |

**Packages removed due to [SLOP] verdict:** none. [VERIFIED: no new package install planned]
**Packages flagged as suspicious [SUS]:** none by verdict; `dotenv` dependency movement should be gated because the seam timed out. [VERIFIED: tool output]

## Architecture Patterns

### System Architecture Diagram

```text
Operator selects --target <id>
        |
        v
Target profile registry (non-secret TS data)
        |
        v
Valibot schema + cross-field validation
        |
        +--> static profile errors (missing resource/url/secret metadata) -> hard fail
        |
        v
Resolver produces TargetResolution
        |
        +--> Projection writer
        |       |--> apps/api/.dev.vars target-managed block
        |       |--> apps/gateway/.dev.vars target-managed block
        |       |--> .env.local target-managed block
        |       `--> packages/crawler/.env target-managed block
        |
        +--> Projection validator
        |       `--> mismatch / legacy alias / missing required key -> hard fail
        |
        +--> Local identity validator
        |       `--> expected Wrangler profile + account_id; token shadowing -> hard fail
        |
        `--> Live resource validator (remote high-risk commands only)
                |--> Wrangler D1 info/list
                |--> Wrangler R2 bucket info/list
                `--> Wrangler KV namespace list
```

### Recommended Project Structure

```text
packages/config/
├── src/
│   └── deployment-target/
│       ├── index.ts                  # public exports for scripts/tests
│       ├── target-profile.schema.ts  # Valibot schema + typed errors
│       ├── target-profiles.ts        # tracked non-secret profile map
│       ├── resolve-target.ts         # explicit selected target resolver
│       ├── projection-plan.ts        # maps profile to final env keys
│       ├── env-file-block.ts         # marker-aware dotenv block updater
│       ├── preflight.ts              # static/projection/local/live validation orchestration
│       └── __tests__/                # schema, resolver, projection, fail-closed tests
├── package.json
└── vitest.config.ts                  # can reuse ./vitest-base.ts or root pattern

scripts/
└── target-profile.ts                 # thin tsx CLI wrapper: validate/project/preflight
```

This layout keeps profile logic inside the shared config package and leaves workflow/runtime adoption to Phase 12. [VERIFIED: packages/config/package.json] [VERIFIED: .planning/ROADMAP.md]

### Pattern 1: Strict Profile Schema

**What:** Define `TargetProfile` with precise unions and a strict runtime schema; reject unknown/legacy keys rather than silently dropping them. [CITED: https://valibot.dev/guides/objects/]

**When to use:** Use for parsing every tracked profile and every test fixture before projection. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]

**Example:**

```typescript
// Source: https://valibot.dev/guides/objects/
import * as v from 'valibot'

const targetProfileSchema = v.strictObject({
  id: v.string(),
  cloudflare: v.strictObject({
    accountId: v.string(),
    zoneName: v.string(),
  }),
  urls: v.strictObject({
    gateway: v.pipe(v.string(), v.url()),
    api: v.pipe(v.string(), v.url()),
    dashboard: v.pipe(v.string(), v.url()),
    auth: v.pipe(v.string(), v.url()),
    blog: v.pipe(v.string(), v.url()),
    movie: v.pipe(v.string(), v.url()),
    comic: v.pipe(v.string(), v.url()),
    tavern: v.pipe(v.string(), v.url()),
  }),
})
```

### Pattern 2: Target-Managed Env Blocks

**What:** Update only a marked block in each env file, while preserving all user-managed lines outside the block. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]

**When to use:** Use for `apps/api/.dev.vars`, `apps/gateway/.dev.vars`, root `.env.local`, and `packages/crawler/.env`. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]

**Example:**

```text
# starye-target-managed:start target=starye-org generated=2026-07-14T00:00:00.000Z
VITE_API_URL=http://localhost:8080
NUXT_PUBLIC_API_URL=http://localhost:8080
# starye-target-managed:end
```

### Pattern 3: Local vs CI Identity Split

**What:** Local preflight validates the expected Wrangler auth profile and rejects `CLOUDFLARE_API_TOKEN` shadowing; CI preflight validates selected target maps to the expected GitHub environment/secret bundle. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/] [CITED: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/]

**When to use:** Use before local live checks and later before Phase 12 deploy/migration/crawler/rollback workflows. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]

### Anti-Patterns to Avoid

- **Implicit default target:** D-16 forbids every command and workflow from relying on a default target. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]
- **Overlay profile composition:** D-01 forbids account/domain/resource overlays. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]
- **Secret values in tracked profile files:** D-04 and Cloudflare docs both require secret values to stay outside plaintext profile/config files. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] [CITED: https://developers.cloudflare.com/workers/configuration/environment-variables/]
- **Warning-only mixed target detection:** D-09 requires hard failure for identity mismatch. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]
- **Direct app ports as canonical local URLs:** AGENTS requires `http://localhost:8080/...` as local canonical URL. [VERIFIED: AGENTS.md]

## Current Env / Config Surface Inventory

| Surface | Current target-sensitive values | Phase 11 action | Integration risk |
|---------|--------------------------------|-----------------|------------------|
| `.env.example` | `VITE_API_URL=http://localhost:8080`, `NUXT_PUBLIC_API_URL=http://localhost:8080` | Use as local public env projection baseline. [VERIFIED: .env.example] | Do not change canonical local URL away from gateway. [VERIFIED: AGENTS.md] |
| `apps/api/wrangler.toml` | Worker `starye-api`, `WEB_URL`, `ADMIN_URL`, D1 `starye-db` + UUID, R2 `starye-media`, route `api.starye.org`, KV ID | Reverse-map into profile; static preflight can compare tracked singleton config to selected profile until Phase 12 consumes generated config. [VERIFIED: apps/api/wrangler.toml] | Missing `account_id` means Wrangler account failsafe is not yet pinned in config; profile/local preflight should compensate in Phase 11 and Phase 12 can wire config. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/] |
| `apps/gateway/wrangler.toml` | Gateway dev port `8080`, origins for api/auth/dashboard/blog/movie/comic/tavern, routes `starye.org` and `www.starye.org`, KV ID | Profile must explicitly carry all origins and gateway routes. [VERIFIED: apps/gateway/wrangler.toml] | Gateway runtime has local fallback ports; those are allowed local behavior but must not become deploy target defaults. [VERIFIED: apps/gateway/src/index.ts] |
| `apps/dashboard/wrangler.toml` | Pages project `starye-dashboard`, production `VITE_API_URL=https://api.starye.org` | Add dashboard Pages metadata and public URL/API URL to profile. [VERIFIED: apps/dashboard/wrangler.toml] | Other Pages apps lack tracked Wrangler files; their project names are in GitHub workflows. [VERIFIED: .github/workflows/deploy-*.yml via rg] |
| `apps/api/src/config.ts` | Hard-coded `starye.org`, `www.starye.org`, direct localhost app ports, plus `WEB_URL` and `ADMIN_URL` additions | Do not rewrite in Phase 11; flag as Phase 12/14 risk and test fixture input. [VERIFIED: apps/api/src/config.ts] | Old-domain and direct-port fallbacks can mask mismatched profile state if preflight only checks final CORS output. [VERIFIED: codebase] |
| `apps/auth/nuxt.config.ts`, `apps/blog/nuxt.config.ts` | `apiUrl = NUXT_PUBLIC_API_URL || VITE_API_URL || http://localhost:8080` | Projection should feed `NUXT_PUBLIC_API_URL`/`VITE_API_URL`; typed public config belongs to Phase 12. [VERIFIED: apps/auth/nuxt.config.ts] [VERIFIED: apps/blog/nuxt.config.ts] | `apps/auth/app/lib/auth-client.ts` and `apps/blog/app/lib/auth-client.ts` also read `import.meta.env.VITE_API_URL`. [VERIFIED: rg] |
| `packages/crawler/scripts/check-config.ts` | Checks R2 account/key/bucket/public URL, API URL, crawler secret | Replace or wrap with target-aware check after projection. [VERIFIED: packages/crawler/scripts/check-config.ts] | Current guidance tells users to copy from API `.dev.vars`, which D-05/D-08 should eliminate. [VERIFIED: packages/crawler/scripts/check-config.ts] |
| `scripts/pre-deploy-check.ps1` | Prints `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BETTER_AUTH_SECRET`; no target validation | Add a callout or wrapper to invoke TypeScript target preflight. [VERIFIED: scripts/pre-deploy-check.ps1] | Current script is warning/info-oriented for env, not hard fail-closed. [VERIFIED: scripts/pre-deploy-check.ps1] |
| `.github/workflows/deploy-api.yml`, `deploy-gateway.yml` | Use repo-level `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` | Phase 11 profile should define `ci.githubEnvironment`/secret bundle metadata; actual workflow consumption is Phase 12. [VERIFIED: .github/workflows/deploy-api.yml] [VERIFIED: .github/workflows/deploy-gateway.yml] |
| `.github/workflows/deploy-migrations.yml` | Hard-coded `starye-db`; R2 backup uses `R2_BUCKET_NAME`; remote D1 operations | Profile should model D1 name/id and backup bucket metadata. [VERIFIED: .github/workflows/deploy-migrations.yml] | Remote mutation path requires live validation per D-12 before Phase 12 rewires it. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |
| `.github/workflows/daily-manga-crawl.yml` | Uses `API_URL`, `CRAWLER_SECRET`, R2 secrets, `CLOUDFLARE_ACCOUNT_ID` | Profile should model crawler consumer secret metadata and expected API URL. [VERIFIED: .github/workflows/daily-manga-crawl.yml] | Other crawler workflows have the same target surface and must be included in Phase 12 blast radius. [VERIFIED: .github/workflows via rg] |
| `.github/workflows/rollback.yml` | Worker rollback names `starye-api` and `starye-gateway`; Pages rollback fails closed | Profile should include worker names and CI secret bundle metadata. [VERIFIED: .github/workflows/rollback.yml] | Good existing Pages rollback behavior is fail-closed and should not be weakened. [VERIFIED: .github/workflows/rollback.yml] |

## Recommended Profile Contract

Use a single explicit `TargetProfile` per deployable target. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]

Minimum fields:

- `id`, `label`, `kind` for explicit selected-target identity. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]
- `cloudflare.accountId`, `cloudflare.zoneName`, optional `zoneId` if known. [CITED: https://developers.cloudflare.com/workers/wrangler/configuration/]
- `local.wranglerProfile` for D-14. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/]
- `ci.githubEnvironment` and `ci.secretBundleName` for D-15. [CITED: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/]
- `workers.api` and `workers.gateway` with Worker names, route patterns, vars, D1/R2/KV binding metadata. [VERIFIED: apps/api/wrangler.toml] [VERIFIED: apps/gateway/wrangler.toml]
- `pages.dashboard`, `pages.auth`, `pages.blog`, `pages.movie`, `pages.comic`, and `pages.tavern` with project names and canonical public URLs. [VERIFIED: .github/workflows via rg] [VERIFIED: apps/gateway/wrangler.toml]
- `d1.primary` with binding, database name, database ID, migrations directory, and required DB tooling secret metadata. [VERIFIED: apps/api/wrangler.toml] [VERIFIED: packages/db/drizzle.config.ts]
- `r2.media` with binding, bucket name, public URL, account ID, and required access secret metadata. [VERIFIED: apps/api/wrangler.toml] [VERIFIED: apps/api/src/lib/auth.ts]
- `kv.cache` with binding, id, preview id, and all consumers. [VERIFIED: apps/api/wrangler.toml] [VERIFIED: apps/gateway/wrangler.toml]
- `urls` object explicitly covering `gateway`, `api`, `dashboard`, `auth`, `blog`, `movie`, `comic`, and `tavern`. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]
- `requiredSecrets[]` with `name`, `required`, `consumers`, and `location` metadata only; never values. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] [CITED: https://developers.cloudflare.com/workers/configuration/environment-variables/]

Recommended target-managed local keys:

| File | Target-managed keys | Preserve user-managed keys |
|------|---------------------|----------------------------|
| `apps/api/.dev.vars` | `WEB_URL`, `ADMIN_URL`, `BETTER_AUTH_URL`, `CLOUDFLARE_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | `BETTER_AUTH_SECRET`, `CRAWLER_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `ADMIN_GITHUB_ID`, `OPENROUTER_API_KEY`, `SENTRY_DSN`, `SENTRY_RELEASE`, local-only `PORT`. [VERIFIED: env key inventory] |
| `apps/gateway/.dev.vars` | `API_ORIGIN`, `AUTH_ORIGIN`, `DASHBOARD_ORIGIN`, `BLOG_ORIGIN`, `MOVIE_ORIGIN`, `COMIC_ORIGIN`, `TAVERN_ORIGIN` | `ADMIN_GITHUB_ID`, Sentry/local-only keys if present. [VERIFIED: env key inventory] |
| `.env.local` | `VITE_API_URL`, `NUXT_PUBLIC_API_URL`, optional `VITE_ADMIN_URL`, optional `VITE_R2_URL` | Local secrets and non-public keys such as `BETTER_AUTH_SECRET` and `CRAWLER_SECRET`. [VERIFIED: .env.example] [VERIFIED: env key inventory] |
| `packages/crawler/.env` | `API_URL`, `CLOUDFLARE_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CRAWLER_SECRET`, `PUPPETEER_EXECUTABLE_PATH`, crawl limits, upload toggles. [VERIFIED: packages/crawler/scripts/check-config.ts] [VERIFIED: env key inventory] |

Legacy aliases to block unless explicitly modelled:

- `R2_ACCOUNT_ID` and `R2_PUBLIC_DOMAIN` appear in local API `.dev.vars` key inventory but are not consumed by the primary API `Env` contract. [VERIFIED: env key inventory] [VERIFIED: apps/api/src/lib/auth.ts]
- Several crawler scripts fall back to `R2_ACCOUNT_ID`, `localhost:8787`, or `localhost:3000`; these are Phase 12/14 cleanup risks, not acceptable target-resolution defaults. [VERIFIED: rg]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Profile runtime validation | Ad hoc `if (!obj.foo)` trees | Valibot schema + typed issue formatter | Object shape, URL parsing, strict unknown-key rejection, and `safeParse` issue collection are already supported. [CITED: https://valibot.dev/guides/objects/] [CITED: https://valibot.dev/guides/parse-data/] |
| Cloudflare local account switching | Custom token files or env overlay | Wrangler auth profiles for local, `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` for CI | Official docs separate local profiles from CI tokens and define resolution order. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/] [CITED: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/] |
| D1/R2/KV existence checks | Custom Cloudflare REST client | `pnpm exec wrangler d1 info/list`, `r2 bucket info/list`, `kv namespace list` | Wrangler already provides resource commands and respects `--profile`, `--cwd`, `--config`, and account selection semantics. [CITED: https://developers.cloudflare.com/d1/wrangler-commands/] [CITED: https://developers.cloudflare.com/r2/reference/wrangler-commands/] [CITED: https://developers.cloudflare.com/kv/reference/kv-commands/] |
| Env projection safety | Overwrite whole `.dev.vars` or `.env.local` files | Marker-aware target-managed block updater | D-08 requires preserving user secrets and non-target-managed local values. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |
| CI target selection | Manual secret override in workflow UI | Profile-declared GitHub environment/secret bundle | D-15 forbids hand-selecting secret source outside the mapped target. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |

**Key insight:** The hard part is not serializing a profile; it is preventing partial target switches where profile, projected files, local Wrangler identity, CI secrets, and live resources disagree. [VERIFIED: .planning/research/SUMMARY.md]

## Validation / Preflight Commands

Recommended commands for Phase 11:

```bash
pnpm --filter @starye/config test --run
pnpm exec tsx scripts/target-profile.ts validate --target starye-org
pnpm exec tsx scripts/target-profile.ts project-local --target starye-org --check
pnpm exec tsx scripts/target-profile.ts preflight --target starye-org --scope local
pnpm exec tsx scripts/target-profile.ts preflight --target starye-org --scope remote --live
```

Command behavior:

- `validate` checks profile schema and cross-field consistency only. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]
- `project-local --check` verifies local target-managed blocks match the selected profile without writing. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]
- `project-local --write` may update only marked target-managed blocks and preserve user-managed lines. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]
- `preflight --scope local` rejects missing selected target, projection mismatch, missing required local secret keys, forbidden legacy target-managed aliases, and Wrangler profile mismatch. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/]
- `preflight --scope remote --live` also requires Cloudflare credentials and read-style resource existence checks before deploy/migrate/rollback/remote crawl/smoke. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] [CITED: https://developers.cloudflare.com/d1/wrangler-commands/]

## Local Wrangler Auth vs CI Boundary

Wrangler profiles are a local-machine convenience and do not apply in CI, containers, or automated environments. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/]

Wrangler selects local auth by this priority: `CLOUDFLARE_API_TOKEN`, then `--profile`, then nearest activated directory profile, then default profile. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/]

Within a resolved profile, Wrangler respects `account_id` from config or `CLOUDFLARE_ACCOUNT_ID`; if the active profile cannot reach the account, Wrangler fails instead of falling back. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/]

CI/CD is non-interactive and should use `CLOUDFLARE_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID` stored as CI secrets. [CITED: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/]

Planning implication: Phase 11 should store `local.wranglerProfile` and `ci.githubEnvironment` metadata in the profile, reject local token/profile mixing, and leave workflow environment wiring for Phase 12. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]

## Candidate Plan Decomposition

Recommended dependency order:

1. **Wave 0: Package/test foundation.** Add `packages/config/src/`, package scripts (`test`, optional `type-check`), `vitest.config.ts`, and a thin `scripts/target-profile.ts` wrapper. [VERIFIED: packages/config/package.json] [VERIFIED: packages/config/vitest-base.ts]
2. **Plan 11-01: Profile schema and current target inventory.** Implement `TargetProfile` schema, current `starye-org` non-secret profile, explicit URL/resource/secret metadata, and schema tests. [VERIFIED: apps/api/wrangler.toml] [VERIFIED: apps/gateway/wrangler.toml]
3. **Plan 11-02: Projection model and local env normalization.** Implement projection plan, marker-aware env block updater, `--check`/`--write` modes, and tests that preserve user-managed secrets while cleaning old target-managed residue. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]
4. **Plan 11-03: Fail-closed preflight and identity boundary docs.** Implement static/projection/local/live validation orchestration, Wrangler profile/token boundary checks, CI secret-bundle metadata validation, PowerShell wrapper integration if scoped, and docs in the appropriate Phase 11 artifact or RUNBOOK owner note. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/] [VERIFIED: docs/documentation-ownership.md]
5. **Gate before Phase 12:** Run profile tests, projection check, local preflight, and GitNexus detect-changes before committing implementation. [VERIFIED: AGENTS.md]

## D-01..D-16 Mapping to Research Conclusions

| Decision | Research conclusion |
|----------|---------------------|
| D-01 | Use one explicit `TargetProfile` object per deployable target; do not use Wrangler envs or account/domain overlays as the source of truth in Phase 11. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |
| D-02 | Schema must include stable names/IDs/routes/canonical URLs/required-secret metadata for Workers, Pages, D1, R2, KV, and CI/local identity. [VERIFIED: codebase] |
| D-03 | `profile.urls` must be explicit for gateway/api/dashboard/auth/blog/movie/comic/tavern; current values are spread across gateway vars, API vars, Pages workflows, and dashboard wrangler config. [VERIFIED: codebase] |
| D-04 | Required-secret metadata is `name|required|consumers|location` only; Cloudflare docs say sensitive values should use secrets, `.dev.vars`, `.env`, or CI secret stores. [CITED: https://developers.cloudflare.com/workers/configuration/environment-variables/] |
| D-05 | Implement projection directly to final consumer files, not an intermediate generated env consumed by runtime. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |
| D-06 | Projection targets are exactly `apps/api/.dev.vars`, `apps/gateway/.dev.vars`, `.env.local`, and `packages/crawler/.env`. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |
| D-07 | Generated placeholders may show missing required secret keys, but must not claim the stack is runnable until user-managed secrets exist. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |
| D-08 | Use marker-aware target-managed blocks and tests proving user-managed lines are preserved. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |
| D-09 | All validation modes should return non-zero exit on mismatch; no warning-only branch for target identity. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |
| D-10 | Preflight checks must compare profile, projection files, and explicit command input. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |
| D-11 | Block unmodelled aliases/fallbacks such as `R2_ACCOUNT_ID`, `R2_PUBLIC_DOMAIN`, hard-coded domain defaults not matching the selected profile, and crawler `localhost:8787`/`3000` deploy fallbacks in target-aware contexts. [VERIFIED: rg] |
| D-12 | Remote deploy/migrate/rollback/crawl/smoke preflight needs live read checks for D1/R2/KV and identity; if credentials are absent, fail. [CITED: https://developers.cloudflare.com/d1/wrangler-commands/] |
| D-13 | Keep local Wrangler auth profiles and CI token/account-secret paths separate. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/] |
| D-14 | Profile must declare `local.wranglerProfile`; local preflight should reject `CLOUDFLARE_API_TOKEN` shadowing and mismatched profile/account. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/] |
| D-15 | Profile must declare `ci.githubEnvironment` or equivalent secret bundle; actual workflow environment use is Phase 12. [VERIFIED: .planning/ROADMAP.md] |
| D-16 | CLI and future workflows must require `--target` or explicit equivalent input; no implicit default. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |

## Phase 12/13/14 Boundaries

- **Phase 12:** Actual Workers/Pages/GitHub workflow consumption of selected target, domain-aware API/gateway/auth config, typed frontend public config, and workflow target resolution tests. [VERIFIED: .planning/ROADMAP.md]
- **Phase 13:** Local + production full-chain smoke through gateway/canonical domains, including crawler/fixture -> D1/API/admin -> viewing evidence. [VERIFIED: .planning/ROADMAP.md]
- **Phase 14:** Old-domain literal cleanup, RUNBOOK final account/domain switching procedures, and requirement-to-evidence final checklist. [VERIFIED: .planning/ROADMAP.md]

Do not pull these into Phase 11 except as metadata fields, preflight hooks, or documented downstream risks. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]

## Common Pitfalls

### Pitfall 1: Half-Switched Local Env

**What goes wrong:** A profile validates, but `.dev.vars`, `.env.local`, or crawler `.env` still point to the previous target. [VERIFIED: .planning/research/SUMMARY.md]
**Why it happens:** Profile validation and projection validation are treated as separate manual steps. [ASSUMED]
**How to avoid:** Make preflight compare profile output against all target-managed local files. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]
**Warning signs:** `R2_ACCOUNT_ID`, old domain URLs, or `localhost:8787` appear in target-aware contexts. [VERIFIED: rg]

### Pitfall 2: Wrangler Profile Shadowed by Token

**What goes wrong:** Operator thinks a local Wrangler profile is active, but `CLOUDFLARE_API_TOKEN` takes priority. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/]
**Why it happens:** Wrangler resolution order prioritizes the token environment variable above profile selection. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/]
**How to avoid:** Local profile preflight should fail when `CLOUDFLARE_API_TOKEN` is set unless the scope is explicitly CI/remote-token mode. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/]
**Warning signs:** `CLOUDFLARE_API_TOKEN` exists in local shell while using `--profile`. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/]

### Pitfall 3: Treating CI Secrets as Profile Data

**What goes wrong:** Real token/client secret values leak into tracked target profile files. [VERIFIED: .planning/REQUIREMENTS.md]
**Why it happens:** Required-secret metadata is confused with secret value storage. [ASSUMED]
**How to avoid:** Store only secret names, locations, required flags, and consumers; read local files only for key presence and never print values. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]
**Warning signs:** `CLOUDFLARE_API_TOKEN`, `GITHUB_CLIENT_SECRET`, or `R2_SECRET_ACCESS_KEY` values appear in a tracked profile diff. [VERIFIED: .gitignore]

### Pitfall 4: Planning Against Global Wrangler

**What goes wrong:** Commands fail on this machine because no global `wrangler` command is installed. [VERIFIED: environment audit]
**Why it happens:** Docs often show `npx wrangler`/`wrangler`, while repo uses devDependency/package scripts. [VERIFIED: package.json] [CITED: https://developers.cloudflare.com/workers/wrangler/configuration/]
**How to avoid:** Use `pnpm exec wrangler` or existing package scripts in plans. [VERIFIED: environment audit]
**Warning signs:** A plan step starts with bare `wrangler`. [VERIFIED: environment audit]

### Pitfall 5: Overwriting User Secrets During Projection

**What goes wrong:** Profile switch erases local operator-provided secrets from ignored env files. [ASSUMED]
**Why it happens:** Generator rewrites whole files instead of target-managed blocks. [ASSUMED]
**How to avoid:** Unit-test that non-target-managed lines survive projection exactly. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]
**Warning signs:** Projection code writes the complete `.dev.vars` content from scratch. [ASSUMED]

## Code Examples

### Strict Profile Parse

```typescript
// Source: https://valibot.dev/guides/parse-data/
import * as v from 'valibot'

export function parseTargetProfile(input: unknown): TargetProfile {
  const result = v.safeParse(targetProfileSchema, input)
  if (!result.success) {
    throw new Error(formatTargetProfileIssues(result.issues))
  }
  return result.output
}
```

### Explicit Target Resolver

```typescript
// Source: repo pattern from packages/api-types/src/storage-purpose-policy.ts
export function resolveTargetProfile(
  targetId: string | undefined,
  profiles: ReadonlyMap<string, TargetProfile>,
): TargetProfile {
  if (!targetId) {
    throw new Error('Missing selected target. Pass --target <id>.')
  }

  const profile = profiles.get(targetId)
  if (!profile) {
    throw new Error(`Unknown target profile: ${targetId}`)
  }

  return profile
}
```

### Marker-Aware Projection Assertion

```typescript
// Source: D-07/D-08 in .planning/phases/11-deployment-target-foundation/11-CONTEXT.md
export function assertProjectionMatches(
  filePath: string,
  expected: ReadonlyMap<string, string>,
  actual: ReadonlyMap<string, string>,
): void {
  for (const [key, value] of expected) {
    if (actual.get(key) !== value) {
      throw new Error(`${filePath}: target-managed key ${key} does not match selected target`)
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed / Verified | Impact |
|--------------|------------------|--------------------------|--------|
| Wrangler local login only | Wrangler auth profiles for multiple local accounts, still beta | Docs last updated 2026-07-02 | Profile-aware local preflight is appropriate, but CI must not depend on profiles. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/] |
| KV `kv:namespace` syntax | `wrangler kv namespace ...` syntax | Wrangler >= 3.60.0 per KV docs | Plans should use `pnpm exec wrangler kv namespace list`, not deprecated `kv:namespace`. [CITED: https://developers.cloudflare.com/kv/reference/kv-commands/] |
| TOML-only Wrangler config | TOML and JSON/JSONC supported; Cloudflare recommends JSONC for new projects | Wrangler docs last updated 2026-07-09 | Existing repo uses TOML, so Phase 11 should not migrate config format just to define profiles. [CITED: https://developers.cloudflare.com/workers/wrangler/configuration/] [VERIFIED: apps/api/wrangler.toml] |
| Secret names inferred from local files | Wrangler supports `secrets.required` declarations | Wrangler config docs last updated 2026-07-09 | Phase 11 can model required-secret metadata now; adding Wrangler `secrets.required` to runtime config can be considered in Phase 12. [CITED: https://developers.cloudflare.com/workers/wrangler/configuration/] |

**Deprecated/outdated:**
- `kv:...` command syntax is deprecated for Wrangler versions 3.60.0 and later. [CITED: https://developers.cloudflare.com/kv/reference/kv-commands/]
- Workers Sites is deprecated in Wrangler v4, and this phase should not introduce it. [CITED: https://developers.cloudflare.com/workers/wrangler/configuration/]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TS module profiles are preferable to JSON/YAML for this repo. | Standard Stack / Alternatives | If wrong, planner may choose JSON and still satisfy requirements with a strict parser. |
| A2 | PowerShell-only implementation would be harder to test than TypeScript. | Standard Stack / Alternatives | If wrong, planner might keep all preflight logic in PowerShell, increasing coupling to Windows scripts. |
| A3 | Half-switched env usually happens because profile validation and projection validation are separated manually. | Common Pitfalls | If wrong, mitigation still holds because D-10 requires both checks. |
| A4 | Projection overwriting user secrets is a realistic risk. | Common Pitfalls | If wrong, marker-aware preservation remains required by D-08. |

## Open Questions (RESOLVED)

1. **Profile IDs and GitHub environment names**
   - Resolution: Phase 11 uses `starye-org` as the tracked current-target fixture id and as the concrete GitHub environment / secret bundle name for CI metadata. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] [ASSUMED]
   - Planning consequence: `TargetProfile.local.wranglerProfile` and `TargetProfile.ci.githubEnvironment` must both be testable concrete fields for the `starye-org` fixture; plans must not leave D-14/D-15 as abstract metadata. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]

2. **`apps/api/wrangler.toml` `account_id` timing**
   - Resolution: Phase 11 profiles include account identity metadata and preflight validation rules, but do not mutate Worker/Pages Wrangler config consumption. That deploy/runtime consumption belongs to Phase 12 unless a change is strictly a non-runtime validation fixture. [VERIFIED: .planning/ROADMAP.md]
   - Planning consequence: Do not add `account_id` to `apps/api/wrangler.toml` in Phase 11 as deploy behavior; validate selected-target metadata through `@starye/config` and CLI preflight instead. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]

3. **`dotenv` dependency movement**
   - Resolution: Phase 11 avoids new dependency installation and should not promote `dotenv` into `@starye/config` unless a human explicitly approves a package-boundary change later. [VERIFIED: packages/crawler/package.json] [VERIFIED: tool output]
   - Planning consequence: Use existing TypeScript/Node parsing utilities or small tested parser logic for target-managed env blocks; if executor discovers dependency movement is unavoidable, it must stop for a checkpoint instead of adding the dependency silently. [VERIFIED: tool output]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | TS scripts/tests | yes | `v24.0.1` | none needed. [VERIFIED: environment audit] |
| pnpm | Workspace scripts | yes | `10.33.0` | none needed. [VERIFIED: environment audit] |
| npm | Registry verification | yes | `11.3.0` | none needed. [VERIFIED: environment audit] |
| git | Status/commit workflow | yes | `2.39.2.windows.1` | none needed. [VERIFIED: environment audit] |
| PowerShell Core | Existing local scripts | yes | `7.6.1` | TypeScript CLI for core logic. [VERIFIED: environment audit] |
| Wrangler global CLI | Live Cloudflare checks | no | — | Use repo devDependency through `pnpm exec wrangler`. [VERIFIED: environment audit] [VERIFIED: package.json] |
| Cloudflare credentials | Live remote preflight | not verified | — | Static/projection validation can run; remote high-risk commands must fail closed if credentials are absent. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |

**Missing dependencies with no fallback:**
- Cloudflare credentials for `--scope remote --live`; D-12 requires blocking high-risk remote commands when credentials are unavailable. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md]

**Missing dependencies with fallback:**
- Global `wrangler`; use `pnpm exec wrangler`. [VERIFIED: environment audit]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest repo `^4.1.4`, npm latest `4.1.10`. [VERIFIED: package.json] [VERIFIED: npm registry] |
| Config file | Existing shared base: `packages/config/vitest-base.ts`; `@starye/config` needs its own `vitest.config.ts` or package test script. [VERIFIED: packages/config/vitest-base.ts] [VERIFIED: packages/config/package.json] |
| Quick run command | `pnpm --filter @starye/config test --run` after Wave 0 adds the script. [VERIFIED: turbo.json] |
| Full suite command | `pnpm test` after package script is added; targeted Phase 11 gate should also run `pnpm exec tsx scripts/target-profile.ts validate --target starye-org`. [VERIFIED: package.json] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PROF-01 | Valid current profile includes account/domain/Workers/Pages/D1/R2/KV/URLs/secret metadata and contains no secret values | unit | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/target-profile.schema.test.ts -x` | no, Wave 0. [VERIFIED: rg --files] |
| PROF-02 | `validate` and `preflight` reject missing selected target before remote commands | unit/CLI smoke | `pnpm exec tsx scripts/target-profile.ts validate --target starye-org` | no, Wave 0. [VERIFIED: rg --files] |
| PROF-03 | Missing account/domain/resource IDs/bucket names/required secret metadata returns non-zero fail-closed errors | unit | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/preflight.test.ts -x` | no, Wave 0. [VERIFIED: rg --files] |
| PROF-04 | Local profile mismatch and token/profile mixing fail; CI secret bundle metadata is required | unit | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/identity-boundary.test.ts -x` | no, Wave 0. [VERIFIED: rg --files] |
| ENV-01 | Projection plan writes only target-managed keys for API/gateway/root/crawler env files | unit | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/projection-plan.test.ts -x` | no, Wave 0. [VERIFIED: rg --files] |
| ENV-02 | Projection check fails if local env files are missing required target-managed keys or contain stale target-managed residue | unit/CLI smoke | `pnpm exec tsx scripts/target-profile.ts project-local --target starye-org --check` | no, Wave 0. [VERIFIED: rg --files] |
| TEST-02 | Valid profile resolution and mismatch cases are automated | unit | `pnpm --filter @starye/config test --run` | no, Wave 0. [VERIFIED: packages/config/package.json] |

### Sampling Rate

- **Per task commit:** `pnpm --filter @starye/config test --run` plus the relevant CLI smoke. [VERIFIED: turbo.json]
- **Per wave merge:** `pnpm test` and targeted profile preflight. [VERIFIED: package.json]
- **Phase gate:** Full suite green where practical, target profile validation/projection/preflight green, and GitNexus detect-changes before commit. [VERIFIED: AGENTS.md]

### Wave 0 Gaps

- [ ] `packages/config/src/deployment-target/` module tree. [VERIFIED: rg --files]
- [ ] `packages/config/vitest.config.ts`. [VERIFIED: packages/config]
- [ ] `packages/config/package.json` scripts for `test`, optional `type-check`, and exports for `./deployment-target`. [VERIFIED: packages/config/package.json]
- [ ] `scripts/target-profile.ts` CLI wrapper. [VERIFIED: rg --files]

## Security Domain

Security enforcement is enabled because `.planning/config.json` does not set `security_enforcement: false`. [VERIFIED: .planning/config.json]

OWASP ASVS is a web application security verification standard; its index references ASVS 5.0.x categories. [CITED: https://owasp.org/www-project-application-security-verification-standard/] [CITED: https://cheatsheetseries.owasp.org/IndexASVS.html]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Preserve GitHub OAuth/Better Auth secret metadata only; never store `GITHUB_CLIENT_SECRET` values in profile. [VERIFIED: apps/api/src/lib/auth.ts] |
| V3 Session Management | indirect | Ensure `WEB_URL`/`BETTER_AUTH_URL` projection does not silently switch cookie domain or auth base URL to an unselected target. [VERIFIED: apps/api/src/lib/auth.ts] |
| V4 Access Control | yes | CI environment/secret bundle selection must be target-mapped and not manually overridden. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] |
| V5 Input Validation | yes | Validate profile input with Valibot strict schemas and URL parsing. [CITED: https://valibot.dev/guides/objects/] |
| V6 Cryptography / Secret Handling | yes | Keep secrets in `.dev.vars`, `.env`, Wrangler/GitHub secrets; profile stores metadata only. [CITED: https://developers.cloudflare.com/workers/configuration/environment-variables/] |
| V14 Configuration | yes | Treat profile + Wrangler config + env projection as security-sensitive configuration and fail closed on mismatch. [CITED: https://owasp.org/www-project-application-security-verification-standard/] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret value committed in target profile | Information Disclosure | Store only secret metadata; `.gitignore` already ignores `.env*` and `.dev.vars`; tests should assert known secret key values are not in profiles. [VERIFIED: .gitignore] |
| Deploy/migration against wrong account | Spoofing / Tampering | Require selected target, local Wrangler profile/account match, CI environment mapping, and live resource checks for remote scopes. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/] |
| Legacy fallback URL bypasses target profile | Tampering | Reject unmodelled aliases/fallbacks in preflight and keep old-domain cleanup for Phase 14. [VERIFIED: rg] [VERIFIED: .planning/ROADMAP.md] |
| Public env leaks private values through Vite/Nuxt prefix | Information Disclosure | Projection must only put public URLs into `VITE_*`/`NUXT_PUBLIC_*`; secret metadata stays out of public env. [VERIFIED: .env.example] |
| Shell command injection via profile field | Elevation of Privilege | Validate identifiers/URLs and pass Wrangler arguments as argv in Node instead of shell-concatenated strings. [ASSUMED] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/11-deployment-target-foundation/11-CONTEXT.md` - locked D-01..D-16 decisions and Phase 11 boundaries. [VERIFIED: codebase]
- `.planning/REQUIREMENTS.md` - PROF/ENV/TEST requirement descriptions and traceability. [VERIFIED: codebase]
- `.planning/ROADMAP.md` - Phase 11/12/13/14 scope split and success criteria. [VERIFIED: codebase]
- `apps/api/wrangler.toml`, `apps/gateway/wrangler.toml`, `apps/dashboard/wrangler.toml` - current singleton Cloudflare target fields. [VERIFIED: codebase]
- `apps/api/src/config.ts`, `apps/api/src/lib/auth.ts`, `apps/gateway/src/index.ts`, Nuxt configs, crawler check script, and workflows - integration risks and env consumers. [VERIFIED: codebase]

### Secondary (MEDIUM confidence)

- Cloudflare Wrangler profiles docs - local auth profiles, resolution order, CI boundary. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/]
- Cloudflare GitHub Actions docs - CI token/account ID requirements. [CITED: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/]
- Cloudflare Workers env vars and Wrangler config docs - vars/secrets/dev vars, `secrets.required`, routes, bindings, source-of-truth guidance. [CITED: https://developers.cloudflare.com/workers/configuration/environment-variables/] [CITED: https://developers.cloudflare.com/workers/wrangler/configuration/]
- Cloudflare D1/R2/KV command docs - read/mutation command split for live preflight planning. [CITED: https://developers.cloudflare.com/d1/wrangler-commands/] [CITED: https://developers.cloudflare.com/r2/reference/wrangler-commands/] [CITED: https://developers.cloudflare.com/kv/reference/kv-commands/]
- Valibot docs - object schemas and `safeParse` validation. [CITED: https://valibot.dev/guides/objects/] [CITED: https://valibot.dev/guides/parse-data/]
- OWASP ASVS project/index - security category grounding. [CITED: https://owasp.org/www-project-application-security-verification-standard/] [CITED: https://cheatsheetseries.owasp.org/IndexASVS.html]

### Tertiary (LOW confidence)

- Assumptions in the Assumptions Log only. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions and existing dependencies were verified from repo files and npm registry; no new package install is recommended. [VERIFIED: package.json] [VERIFIED: npm registry]
- Architecture: HIGH - target profile boundaries are locked by `11-CONTEXT.md` and current repo env/deploy surfaces are directly visible. [VERIFIED: .planning/phases/11-deployment-target-foundation/11-CONTEXT.md] [VERIFIED: codebase]
- Pitfalls: HIGH for repo-visible drift and Cloudflare auth boundary, MEDIUM for implementation-specific projection risks. [VERIFIED: rg] [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/]

**Research date:** 2026-07-14
**Valid until:** 2026-08-13 for repo-local architecture; 2026-07-21 for Wrangler profile behavior because the official docs mark profiles as beta. [CITED: https://developers.cloudflare.com/workers/wrangler/profiles/]
