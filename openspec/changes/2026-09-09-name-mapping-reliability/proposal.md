## Why
名字映射会把短错误页当作有效页面，且失败记录会永久跳过，导致女优/厂商关联质量长期下降。
## What Changes
- 映射页面 SHALL 通过标题、正文长度和错误标记校验。
- 未匹配记录 SHALL 在 7 天冷却后自动重试。
## Capabilities
### New Capabilities
- `name-mapping-reliability`: 映射错误页防护与可恢复重试。
### Modified Capabilities
## Impact
影响共享 NameMapper、ActorCrawler、PublisherCrawler；不修改数据库结构和外部来源。
