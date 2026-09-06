# 提案：扩展 AkShare 公司股本结构备用来源

## 背景

Quant 股本变化证据当前只有 Eastmoney `CapitalStockStructure/PageAjax`。Eastmoney 返回空历史或异常时，股本证据会显示来源不可用，进而无法核对总股本变化和回购导致的股本减少。AkShare 的 `stock_share_change_cninfo` 返回公司级总股本、变动日期和变动原因，可作为独立来源；其股东持仓变动端点不属于本需求范围。

## 目标

- 在 AkShare bridge 中接入 CNInfo 公司股本变动端点，只保留请求证券的总股本事件。
- 在 Eastmoney 股本历史为空或失败时回退 AkShare，并贯穿真实 `akshare` provider 到 API、研究报告和 Quant 详情。
- 保留总股本差值、回购减少股数、来源错误和行业边界的既有公式与语义。

## 非目标

- 不把股东持仓变动、基金持仓、限售股明细当作公司总股本事件。
- 不修改股本变化公式、回购金额、分红、现金流、推荐或 D1 schema。
- 不新增资本结构持久化表，不把计划回购数量推导为总股本变化。

## 影响与风险

涉及 Python bridge contract/normalizer/adapter、API AkShare parser/provider chain、股东回报来源类型和 Quant capital parser。`QuantCapitalStructureProvider` 是高扇出接口，保持现有方法与 Eastmoney 行为，新增可选 `akshare` 来源字段；CNInfo 字段版本变化、合法空历史和日期口径由稳定错误码与 `null` 边界处理。

## 验收

覆盖 CNInfo 代码过滤、总股本/日期/原因归一化、空值和非有限值、Eastmoney 空历史回退、旧 bridge payload、API/Quant provider provenance、OpenSpec strict、GitNexus 和 Gateway 鉴权边界。
