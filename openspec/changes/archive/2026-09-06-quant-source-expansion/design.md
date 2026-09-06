## 设计目标

本 change 保持现有报告、D1 和刷新入口不变，只修正数据健康判定并把已经存在的 AkShare bridge 变成可复用的财报/现金流 provider。主来源顺序仍由当前 `QUANT_DATA_PROVIDER` 决定：Eastmoney 默认，配置 Tushare 时使用 Tushare 与 Eastmoney 的现有链；AkShare 作为最后的可选补充/回退来源，不参与日线写入。

## 数据健康边界

- `apps/quant-app/src/lib/quant-factor-data-health.ts` 只检查 evidence 的适用性、有限原始值和来源健康。
- `factor.status` 继续由价值质量层表示分数/可比样本状态，但不再参与原始字段的 ready/partial 判定。
- `fail` 且有有限值仍计入覆盖，`missing` 或 `null` 才形成补齐动作；`not_applicable` 不进入分母。

## Bridge 与 provider

- Python bridge 在现有 `quant-akshare-v1` response 上新增可选 `cashflows` 字段，扩展财报 alias，并以独立端点收集现金流。
- 现金流 endpoint 使用优先列表和 `getattr` 探测，优先采用稳定的报告口径接口；未安装、超时、空结果和字段缺失都映射为稳定错误码。
- TypeScript bridge client 对缺失的可选 `cashflows` 归一化为空数组，并新增两个 provider adapter，将标准化记录映射为当前财报/现金流 domain 类型。
- provider 链采用组合方式：先运行当前 Eastmoney/Tushare 链，再按相同报告期对 AkShare 结果做字段补充；主链无报告时才把 AkShare 作为 fallback。所有数值使用有限数值检查，报告期和证券代码必须匹配。
- `QuantSourceName` 扩展为 `tushare | eastmoney | akshare`，但主数据 provider 配置和 capability registry 仍只接受现有 Tushare/Eastmoney 选择。

## API、Quant 与兼容性

- 研究报告的 source 文案增加 AkShare 补充/回退标签；已有 `research-report-v1/v2` 的旧报告仍可读取。
- 财报和现金流响应 schema/parser 接受 `akshare`，股息、股本和回购 provider contract 保持原有两来源集合。
- 不增加 D1 migration；刷新动作继续触发确定性报告重算，不自动生成 AI 结论。

## 失败策略

- 主来源部分成功且 bridge 失败：返回主来源已有报告，保持空字段和已有错误边界。
- 主来源完全失败且 bridge 有有效报告：返回 AkShare fallback，并记录主来源的稳定错误码。
- 两端都失败：沿用现有 provider error；不把 `null` 转成 0，也不把 bridge 的旁路 evidence 当作主报告字段。

## 验证策略

- Python 覆盖 alias、DataFrame/列表、空值、端点失败和 response error redaction。
- API 覆盖桥接 response、财报/现金流 mapping、同报告期补充、fallback 和未配置路径。
- Quant 覆盖 16/16 字段但价值质量 partial、阈值 fail 不触发刷新、AkShare 来源标签和 legacy payload。
- 最后运行全套类型/构建/契约检查，再经 Gateway 验证详情页和移动端布局。
