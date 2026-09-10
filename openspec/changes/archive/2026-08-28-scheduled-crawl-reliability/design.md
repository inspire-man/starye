## Context

Daily Manga Crawl 的 native D1 路径当前以 80 页为一个插入语句，每页绑定 6 个变量，生产大章节触发 `D1_ERROR: too many SQL variables`。Daily Movie Crawl 的生产 D1 读回显示最后一个已接受 runner 事件为序号 228，原序号 229 请求返回 500 未落库，补偿序号 230/231 随后成为 `out_of_sequence_event`。

## Goals / Non-Goals

**Goals:**

- 让章节页面插入始终落在 D1 变量安全边界内，同时保留 native batch 的替换语义。
- 让短暂的 runner 控制面 5xx 在事件序列推进前得到同身份恢复机会。
- 用小型 fake D1、fake fetch 和真实签名请求体测试绑定变量数、请求身份和重试次数。

**Non-Goals:**

- 不改变图片来源、图片失败降级策略或外部站点 DNS 行为。
- 不改变 D1 表结构、workflow schedule、事件 schema、鉴权头或状态机规则。
- 不把持久 5xx 伪装成成功，也不绕过事件序列 CAS。

## Decisions

### 1. 共享页面批次安全大小

使用 10 页作为 native D1 和兼容数据库回退路径的页面批次。每条 native 插入语句最多绑定 60 个值，低于已观测的 D1 平台限制，并与现有回退路径的粒度一致。将批次大小命名为局部常量，避免扩大配置面。

备选方案是使用动态变量上限计算；当前平台限制属于固定运行约束，动态探测会增加远程行为和测试复杂度，因此采用固定保守批次。

### 2. 在共享 post 边界重试 5xx

`RunnerClient.post` 在序列化请求体后执行有界的 5xx 重试。请求体和签名在循环外生成，重试只重新发送同一个 body、event ID、nonce 和 sequence；4xx 保持原有立即失败语义。默认采用两次重试和短退避，并通过可注入的延迟值让单元测试保持快速。

备选方案是只在 `progress` 调用处重试；控制面任何生命周期事件都可能受到同类瞬时故障影响，共享边界可以覆盖 heartbeat、log、progress、terminal 以及 claim，同时保留统一的幂等身份。

### 3. 验证层次

先运行 API sync handler 与 crawler runner-client 的窄测试，再运行 crawler task-runner 生产集成、API type-check 和 crawler type-check。提交前运行 staged GitNexus 变更检测。部署后以 Gateway/Actions 为入口，并通过 D1 的 run、runner event、transition 读回确认事件序列连续或按规则收口。

## Risks / Trade-offs

- [临时 5xx 持续存在] -> 重试次数和退避固定；最终仍报告失败，并保留服务端状态。
- [服务端已落库后响应 5xx] -> 复用 event ID、nonce 和 body hash，由服务端的幂等记录返回已存结果。
- [保守批次增加请求数量] -> 页面写入仍使用一次 D1 batch，只有插入语句数量增加，优先保证生产章节完整性。

## Migration Plan

1. 在修复分支运行窄测试、类型检查和 GitNexus staged 检查。
2. 推送并通过 PR CI 后合并到 `main`。
3. 核验合并提交的 CI 与部署 Actions，再观察两个定时入口的下一轮运行和 D1 权威读回。
4. 若 runner 重试仍暴露持久控制面错误，保留失败事件和 request ID，按服务端日志继续定位，不修改生产数据。
