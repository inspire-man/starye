## Why

生产 Gateway 已发布 `/quant` 路由，但没有配置 Quant 前端 origin，因此管理员访问 `https://starye.org/quant/` 时只能看到 `Quant App is not configured`。Quant Pages 项目已经创建，需要把真实 production origin 纳入 target-aware 配置和 provider secret provisioning，避免后续部署再次丢失配置。

## What Changes

- 为 tracked target 增加 Quant 前端 origin 元数据。
- 将 `QUANT_ORIGIN` 纳入 Gateway 生成配置和本地环境 projection。
- 创建并部署 `starye-quant` Pages production project。
- 为 API Worker 配置 server-only `TUSHARE_TOKEN`，不进入仓库、前端构建或日志。
- 通过 Gateway 验证 `/quant/` 页面、静态资源和 API 访问链路。

## Capabilities

### New Capabilities

无。此次建立在现有量化工作台能力之上。

### Modified Capabilities

- `quant-ui-gateway`: 生产 `/quant/*` 必须使用 tracked target 的已部署 Quant origin，且 target-aware Gateway 配置必须输出 `QUANT_ORIGIN`。

## Impact

- 代码：`packages/config/src/deployment-target/` 的 target profile、projection 和 Wrangler config materializer。
- 资源：Cloudflare Pages `starye-quant`、生产 Gateway Worker、生产 API Worker secret。
- 验证：target profile/config 契约测试、Gateway 生产路由测试、生产 `https://starye.org/quant/` smoke。
- 风险：Pages origin 或 API secret 缺失会分别导致页面 503 或同步能力 fail-closed；secret value 不写入 Git 或输出。

