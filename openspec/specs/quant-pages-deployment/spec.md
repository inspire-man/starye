# quant-pages-deployment Specification

## Purpose
为 Quant 工作台提供可审计、可重复的 Cloudflare Pages 构建与发布闭环。

## Requirements

### Requirement: Typed Quant Pages target

目标配置 MUST 将 `quant` 注册为完整的 Pages surface，包含 Pages project、direct origin 和 canonical URL；profile 校验 MUST 拒绝缺少任一字段或 URL 交叉引用错误的配置。

#### Scenario: Valid tracked target

- **WHEN** 解析 `starye-org` target profile
- **THEN** `quant` 出现在 Pages surfaces 中，且 `pages.quant.canonicalUrl` 与 `urls.quant` 一致

#### Scenario: Missing Quant Pages projection

- **WHEN** target profile 缺少 `pages.quant` 或其 project/origin 字段
- **THEN** profile 校验失败，不生成部署投影

### Requirement: Quant Pages build contract

统一 Pages 构建器 MUST 将 Quant 作为 Vite surface 构建 `quant-app`，使用 `/quant/` app base path，生成的环境只包含已登记的公开 runtime 字段；构建失败或 redirect 输入不匹配时 MUST 清理最终 `_redirects`。

#### Scenario: Build Quant Pages

- **WHEN** 执行 `run-pages-build --surface quant`
- **THEN** 先构建共享 API types，再执行 `pnpm --filter quant-app build`，并将受 profile 校验的 redirect 写入 `apps/quant-app/dist/_redirects`

#### Scenario: Quant redirect contract

- **WHEN** 为 tracked target 生成 Quant redirect
- **THEN** direct origin 的请求重定向到 Gateway `/quant/:splat`，并保留 `/* /index.html 200` SPA fallback

#### Scenario: Build input failure

- **WHEN** Quant build env 缺少必需字段、base path 不为 `/quant/` 或 redirect 输入不匹配
- **THEN** 构建在执行 Pages app 前失败，且不保留旧 `_redirects`

### Requirement: Automatic Quant Pages deployment

仓库 MUST 提供独立的 `deploy-quant.yml` workflow，在 `main` 上 Quant app、共享 packages、根构建配置或 lockfile 变化时自动运行，并支持 `workflow_dispatch` 选择 tracked target。workflow MUST 复用 target resolver、CI mutation preparation、统一 Pages build 和 `wrangler pages deploy`，完成后无论成功失败都清理生成文件。

#### Scenario: Push deployment

- **WHEN** `main` 上的 `apps/quant-app/**` 或其共享构建依赖发生变更
- **THEN** workflow 解析 target，使用 prepared Pages project 构建并发布 `apps/quant-app/dist`

#### Scenario: Manual deployment

- **WHEN** 手动运行 workflow 并提供合法 target
- **THEN** workflow 使用该 target 的 GitHub environment 和 Pages project，不接受任意项目名或绕过 target profile 的参数

#### Scenario: Missing or failed preparation

- **WHEN** target 校验、预检或构建失败
- **THEN** workflow 不执行 Pages 发布，并执行 always cleanup；公开构建环境中不得出现 Cloudflare token 或其他 secret
