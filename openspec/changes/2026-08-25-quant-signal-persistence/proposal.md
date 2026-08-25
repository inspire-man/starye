## Why

当前候选研究只展示最新一次快照，单次命中容易被误读为稳定信号。中长线择股需要知道信号是否重复出现、分数朝哪个方向变化，以及哪些因子反复成立，因此应利用已经保留的历史快照补足时间维度。

## What Changes

- 从最近有效候选快照读取单只股票的历史信号表现，不新增数据库表或改变同步写入。
- 为候选返回快照样本数、出现次数、出现比例、最新与前次分数差、历史分数变化、因子出现频次和状态判断。
- 在候选研究表增加“信号持续”列，并在分析详情抽屉展示可读的快照证据链。
- 对没有历史快照、尚未进入最新快照和历史不足的股票分别给出明确状态，不用零值伪造结论。

## Capabilities

### New Capabilities

- `quant-signal-persistence`: 定义候选信号历史持续性、状态判断和证据链展示契约。

### Modified Capabilities

- 无。

## Impact

- API：`apps/api/src/domain/quant/repository.ts`、`apps/api/src/domain/quant/signal-persistence.ts`、`apps/api/src/routes/quant/index.ts`，扩展 `/api/quant/candidates` 返回字段。
- Quant 前端：候选类型、API 解析、候选表和分析详情抽屉。
- 测试：API 路由、纯函数和客户端响应解析。
- 风险：历史快照数量最多 30 个；输出只描述观察池内的已保存样本，不代表全市场，也不构成交易指令。
