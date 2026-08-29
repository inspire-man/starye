## Context

Quant 当前的 `QuantDividendProvider` 只实现 Tushare `dividend`，`shareholder-return.ts` 把 provider 失败记录为 `partial`。Eastmoney 已被用于日线、估值和财报，公开分红接口 `RPT_SHAREBONUS_DET` 能提供实施状态、税前每十股现金红利和除息日，因此适合作为 Tushare 配额不足时的公开回退源。

## Goals / Non-Goals

**Goals:**

- 提供 Tushare 主源和 Eastmoney 回退源的统一分红读取契约。
- 用稳定元数据说明实际来源、回退原因和两层错误，不隐藏 provider 质量。
- 让研究报告和因子来源与真实数据源一致，并保持现有缺失值/推荐门槛。
- 复用现有 D1 日线和按需 provider 读取，不增加数据库迁移。

**Non-Goals:**

- 本 change 不增加用户可编辑的因子权重、provider 管理页面或自动交易能力。
- 本 change 不把计划分红、预计股息或未确认支付日当作已实施现金回报。
- 本 change 不重写日线、估值或财务 provider 的通用回退；它们沿用现有契约。

## Decisions

### 1. 以结构化 fetch result 记录来源

`QuantDividendProvider.fetchDividends` 返回 `{ records, provider, fallbackUsed, fallbackReason }`。Tushare 和 Eastmoney 直接 provider 都返回 `fallbackUsed=false`；组合 provider 在主源成功时透传主源结果，在回退成功时附加主源映射错误码。这样并发读取多只股票时不依赖 provider 的可变全局状态。

### 2. 回退顺序由 route 层确定

路由根据 `resolveQuantProviderName(env)` 构造 provider 顺序：显式或 token 选择的 provider 为主，另一个已配置 provider 为回退；没有 Tushare token 时只构造 Eastmoney。组合 provider 的 `provider` 表示首个实际选择的来源，`providerChain` 表示本次可能使用的顺序。

### 3. Eastmoney 只使用可核对的实施记录

请求 `RPT_SHAREBONUS_DET` 的最小列集合，按 `SECURITY_CODE` 过滤并再次校验返回代码。`ASSIGN_PROGRESS` 只有 `实施分配` 才映射为现有领域值 `实施`；`PRETAX_BONUS_RMB` 是每十股金额，除以 10 作为每股现金分红。Eastmoney 没有可靠支付日时保留 `payDate=null`，使用有效除息日作为股息率观察日期。

### 4. 错误不降级为空记录

组合 provider 在两层都失败时抛出带有 primary/fallback 原始错误的域错误；股东回报服务把它转为可读的错误码串和 missing field。单只失败仍由现有批量 worker 隔离，其他股票继续处理。

### 5. 报告和因子沿用统一证据

股东回报 item 的 provider 信息被研究报告用来动态命名分红 source/evidence；因子模型仍使用稳定的 `shareholder-return` 因子和固定权重，缺失状态只降低覆盖度，不进入零分补偿。用户自定义权重作为后续独立 change。

## Risks / Trade-offs

- Eastmoney 接口字段或状态文本变化：响应 schema、代码、日期和数值均 fail-closed，并覆盖 fixture 测试。
- 两个来源字段口径差异：报告保留来源与回退原因，分红公式只接受实施记录，不混合两源记录。
- 回退增加一次网络请求：每只股票最多两个 provider 请求，沿用现有 4 并发限制和单只失败隔离。

## Migration Plan

无需迁移。先运行领域、路由、客户端和 Quant UI 测试，再用 fixture 验证 Tushare quota -> Eastmoney 的回退结果、研究报告来源和 D1 现有报告读回；Gateway 验证通过后随 API/Quant 部署发布。
