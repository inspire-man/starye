## 设计概览

新增 `buildQuantFactorDataHealth(report)`，从当前研究报告的 `factorModel.factors` 和 `evidence` 建立因子到证据的映射。函数不发起请求、不改写报告，只返回供 UI 展示的派生快照。

## 状态规则

- 只处理权重大于 0 且权重为有限数的因子；没有因子模型或没有正权重因子时，汇总状态为 `missing`。
- 因子引用的 evidence 全部为 `pass`/`caution`、因子状态为 `ready` 且没有缺失 key 时，字段状态为 `ready`。
- 有部分可用 evidence 但存在 `fail`/`missing`/未找到 key，或因子状态为 `partial` 时，字段状态为 `partial`。
- 没有可用 evidence 时为 `missing`；因子或来源明确不可用时为 `unavailable`。
- 来源名称包含回退、fallback、quota、失败或不可用时，单独返回 `fallback` 来源标记；它不会把有效字段伪装成缺失。

汇总同时返回总权重、字段已就绪权重和按权重计算的覆盖率。覆盖率只表达原始字段可用度，不代表因子表现、价值质量或买卖判断。

## 界面

推荐区显示汇总状态和可用权重；每项显示因子名称/权重、字段状态、来源与观察时间、可用 evidence 数量、缺失/失败 key 及下一步补齐动作。长来源和 key 可换行，390px 下改为单列。

## 验证

纯函数测试覆盖状态聚合、权重覆盖、证据缺失、未知 key、来源回退和不可用来源；组件测试覆盖健康区显示、补齐文案、推荐不变和窄屏无溢出。运行 Quant 全量测试、type-check、lint、build、OpenSpec strict 和 Gateway 回归。
