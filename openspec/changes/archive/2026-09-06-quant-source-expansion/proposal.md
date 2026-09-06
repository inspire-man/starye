## Why

当前 Quant 的“部分覆盖”同时混用了原始字段缺失、价值质量不可比和阈值需要复核三种状态。真实页面已经出现 `16 / 16` 字段全部返回但仍显示“部分覆盖”的情况，用户因此无法判断下一步是刷新来源、等待报告，还是仅核对业务口径。与此同时，AkShare bridge 目前只作为旁路交叉核对来源，尚未参与财报和现金流字段补充，Eastmoney 或 Tushare 出现单字段缺失时仍会留下可恢复的空洞。

## What Changes

- 让因子数据健康只根据适用字段的有限原始值和来源健康判断覆盖状态；价值质量的可比样本、评分状态和阈值风险继续独立展示。
- 扩展 AkShare bridge 的标准化结果，增加财报可补充字段和现金流报告字段，并保留逐端点错误。
- 将已配置的 AkShare bridge 接入财报和现金流 provider 链；按相同报告期只填充主来源的 `null` 字段，保留主来源值、行业口径和回退元数据。
- 更新 API、Quant parser、响应 schema、来源文案和测试，使 `akshare` 的补充来源可回看，bridge 部分失败不会覆盖已有数据。
- 更新 bridge README 和项目状态，记录配置前提、来源顺序及验证结果。

## Capabilities

### New Capabilities

- `quant-source-expansion`：提供可配置 AkShare bridge 的财报与现金流字段补充、逐端点错误和来源追踪。

### Modified Capabilities

- `quant-evidence-source-health`：原始字段覆盖不得被价值质量可比性或阈值状态降级。

## Non-Goals

- 不把有限但未达到阈值的值改成通过，也不改变确定性评分、研究动作、推荐或买卖判断。
- 不使用零值、上一期值、跨报告期值或未经验证的行业替代值填补缺口。
- 不新增 D1 表；不把 AkShare token、请求体或上游异常详情写入日志、响应或持久化报告。
- 不在本 change 中接入商品价格、行业指数或一致预期等新的研究维度。

## Impact

- API：Quant provider 类型、财报/现金流 provider 链、研究报告来源元数据和错误映射。
- Bridge：`apps/quant-akshare-bridge` 的请求采集、字段归一化和测试 fixture。
- Quant：因子数据健康计算、财报/现金流 provider parser、来源展示和回退状态。
- Contract：现有研究报告和财报/股东回报 response 增加 `akshare` 来源的可读兼容值；保留 `quant-akshare-v1` 响应的旧字段读取。
- 风险：AkShare endpoint 字段名随版本变化；必须通过 alias、有限数值、证券代码和报告期校验，单端点失败只能造成局部来源缺口。

## Verification

- 覆盖字段完整但价值质量 partial、有限值阈值 fail、来源未配置、bridge 单端点失败、同报告期补充、两端都为空等 fixture。
- 通过 API/Quant/bridge 定向测试、type-check、build、root lint、OpenSpec strict 和 GitNexus detect_changes。
- 通过 Gateway 的 Quant 详情页确认 `16 / 16` 原始字段不再被“部分覆盖”降级，来源补充/失败信息可读，桌面和 390px 页面无横向溢出且浏览器无 error/warn。
