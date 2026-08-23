## Why

Quant Pages 当前可以访问，但仓库没有独立的 Pages 自动部署 workflow。后续 Quant 前端合并到 `main` 后不会随其他子应用发布，生产页面容易继续停留在旧构建。现在已有统一的 target-profile、Pages 构建和 Cloudflare 凭据边界，适合把 Quant 纳入同一条闭环。

## What Changes

- 将 `quant` 注册为类型化的 Pages surface，并补齐目标 profile 的 Pages project、direct origin 和 canonical URL。
- 让统一 Pages 构建器以 Vite 应用方式构建 `apps/quant-app`，使用 `/quant/` base path 和受校验的 `_redirects`。
- 新增 `deploy-quant.yml`，支持 `main` 相关路径变更自动发布和手动选择 tracked target。
- 扩展 target-profile、Pages redirect、runtime env 和 workflow contract 测试，确保构建参数、项目名、清理路径和 secret 边界一致。

非目标：本 change 不创建 Cloudflare Pages 项目、不改变 Quant API/provider/数据库、不改变 Gateway 路由逻辑，也不在本地直接执行生产发布。

## Capabilities

### New Capabilities

- `quant-pages-deployment`：描述 Quant Pages surface、统一构建契约和自动部署 workflow。

### Modified Capabilities

- 无。

## Impact

- 影响 `packages/config` 的 target profile、Pages runtime/redirect/build 投影，`scripts/target-profile.ts`，`.github/workflows/deploy-quant.yml` 及其 contract tests。
- CI 继续复用现有 `starye-org` GitHub environment、`CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`，不把凭据注入浏览器构建环境。
- 共享 surface 类型变更会触及现有 Pages profile 校验和测试；风险集中在 `/quant/` base path、direct origin redirect 与 workflow 路径过滤。
