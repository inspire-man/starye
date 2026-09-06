# 任务

- [x] 1. 扩展 AkShare cashflow normalizer，支持同花顺长表指标聚合，保持累计值、空值和非有限值语义。
- [x] 2. 扩展 bridge cashflow adapter，接入同花顺备用端点并补齐同报告期利润表净利润，保留错误和来源端点。
- [x] 3. 补充 Python、API bridge/provider 和 Quant 现金流回归测试，验证公式、来源链和旧 payload 不变。
- [x] 4. 运行真实 AkShare 抽样、定向/全量测试、type-check/build、lint、OpenSpec strict、GitNexus detect changes 和 Gateway 边界验证。
- [x] 5. 提交、创建 PR、检查 Actions，合并后验证主分支并更新状态文档。PR #89、merge SHA `bfbb379e4fd48a89ebc92af7ab239a07cd4998cc`，合并前 CI `34052848071` 与合并后 CI `34053054393`、Deploy API `34053054428`、Deploy API After PR Merge `34053054478` 均通过。
