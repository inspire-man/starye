# 任务

- [x] 1. 扩展 bridge contract/normalizer/adapter，接入 CNInfo 公司股本变动并保留旧响应兼容。
- [x] 2. 扩展 API AkShare capital parser/provider chain，支持 Eastmoney 空历史/失败回退并保留实际 provider。
- [x] 3. 扩展股东回报类型、研究来源和 Quant capital parser，保持股本公式与 UI 边界不变。
- [x] 4. 补充 Python/API/Quant 测试、真实 AkShare 抽样、type-check/build、lint、OpenSpec strict 和 GitNexus 检查。
- [x] 5. 提交、创建 PR、检查 Actions，合并后验证主分支并更新状态文档。PR #90、merge SHA `e14faac8d5df4af10b6eec558194fdd097be5ee3`；PR checks `34055767804`、合并后 CI `34056015625`、Deploy API `34056015612`、Deploy API After PR Merge `34056015567`、Deploy Quant `34056015583` 均通过；Gateway `/quant/` 为 302、匿名股东回报 API 为 401。
