## ADDED Requirements

### Requirement: 响应压缩启用
系统 SHALL 启用 Brotli 压缩算法压缩 API 响应。

#### Scenario: 自动压缩
- **WHEN** 客户端支持 Brotli 压缩
- **THEN** SHALL 使用 Brotli 压缩响应
- **AND** Content-Encoding SHALL 设置为 br
- **AND** WHEN 客户端不支持 Brotli
- **THEN** SHALL 降级到 Gzip 压缩

#### Scenario: 压缩阈值
- **WHEN** 响应大小小于 1KB
- **THEN** SHALL 不进行压缩
- **AND** WHEN 响应大小大于 1KB
- **THEN** SHALL 启用压缩

### Requirement: 批量查询优化
系统 SHALL 支持批量查询 API，减少网络请求次数。

#### Scenario: 批量电影查询
- **WHEN** 客户端请求多个电影 ID
- **THEN** SHALL 支持单个请求查询多个电影
- **AND** SHALL 使用 POST 方法 /api/movies/batch
- **AND** 响应 SHALL 包含所有请求的电影数据

#### Scenario: 批量查询限制
- **WHEN** 批量查询数量超过 50 个
- **THEN** SHALL 拒绝请求
- **AND** SHALL 返回 400 错误
- **AND** 错误信息 SHALL 提示最大数量

### Requirement: 查询结果缓存
系统 SHALL 缓存频繁查询的 API 结果。

#### Scenario: 热点数据缓存
- **WHEN** 查询热门电影列表
- **THEN** SHALL 缓存响应 5 分钟
- **AND** 同一期间 SHALL 返回缓存结果

#### Scenario: 缓存失效
- **WHEN** 电影数据发生变更
- **THEN** 相关缓存 SHALL 立即失效
- **AND** 后续请求 SHALL 获取最新数据

### Requirement: 分页优化
系统 SHALL 支持高效的分页查询。

#### Scenario: 游标分页
- **WHEN** 查询大量数据时
- **THEN** SHALL 支持游标分页
- **AND** SHALL 使用 after 参数
- **AND** 避免 OFFSET 性能问题

#### Scenario: 分页大小限制
- **WHEN** 未指定分页大小
- **THEN** 默认 SHALL 设置为 20
- **AND** WHEN 指定大小超过 100
- **THEN** SHALL 限制为 100

### Requirement: 数据预加载
系统 SHALL 支持按需加载相关数据。

#### Scenario: 关联数据预加载
- **WHEN** 查询电影详情时
- **THEN** SHALL 预加载演员信息
- **AND** SHALL 预加载播放源信息
- **AND** SHALL 减少后续 API 调用

#### Scenario: 按需加载配置
- **WHEN** 客户端指定 include 参数
- **THEN** SHALL 只加载指定的关联数据
- **AND** 避免 N+1 查询问题