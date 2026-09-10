## ADDED Requirements

### Requirement: 按影片保留进度
同一影片多个播放源切换时 MUST 保留进度，播放失败 MUST NOT 记为观看进度。

#### Scenario: 切源后续播
- **WHEN** 用户从源 A 切换到源 B
- **THEN** 播放位置保持为该影片已保存进度

### Requirement: 统一完播定义
完播阈值、继续观看列表和历史页 MUST 使用同一个服务端定义。

#### Scenario: 详情页继续播放
- **WHEN** 影片已有有效观看进度
- **THEN** 详情页显示上次位置并提供继续播放
