## Why
映射质量看板的 `invalidMappingCount` 当前固定为 0，导致非法映射 URL 无法暴露，质量评分失真。
## What Changes
- 管理端映射质量接口 SHALL 对 R2 映射表中的非法 HTTP(S) URL 计数。
- 保持 D1 业务映射数量、冲突统计和权限边界不变。
## Capabilities
### New Capabilities
- `mapping-quality-integrity`: 映射 URL 完整性指标。
### Modified Capabilities
## Impact
影响 API 管理爬虫质量接口和 Dashboard 已有指标展示，无数据库迁移。
