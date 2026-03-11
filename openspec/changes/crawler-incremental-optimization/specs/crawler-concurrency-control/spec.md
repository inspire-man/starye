## ADDED Requirements

### Requirement: 三级并发控制
系统 SHALL 提供漫画、章节、图片三个层级的并发控制机制，每个层级独立配置并发数。

#### Scenario: 漫画级并发控制
- **WHEN** 爬虫开始处理 28 个漫画列表
- **THEN** 系统同时处理的漫画数量 MUST 不超过配置的 `manga concurrency` 值（默认 2）
- **AND** 其余漫画在队列中等待

#### Scenario: 章节级并发控制
- **WHEN** 单个漫画有 10 个章节需要处理
- **THEN** 系统同时处理的章节数量 MUST 不超过配置的 `chapter concurrency` 值（默认 2）
- **AND** 每个章节的处理独立，互不干扰

#### Scenario: 图片批量并发控制
- **WHEN** 单个章节有 250 张图片需要处理
- **THEN** 系统将图片分批处理，每批大小为 `imageBatch` 值（默认 10）
- **AND** 每批内的图片并发下载、处理、上传
- **AND** 批次间串行执行

### Requirement: 并发限制配置
系统 SHALL 支持通过配置文件或环境变量调整并发参数。

#### Scenario: 使用默认配置
- **WHEN** 未提供自定义配置
- **THEN** 系统使用默认值：manga=2, chapter=2, imageBatch=10

#### Scenario: 环境检测自动调整
- **WHEN** 检测到运行在 GitHub Actions 环境（CI=true）
- **THEN** 系统自动使用保守并发策略
- **AND** 记录日志"检测到 CI 环境，使用保守策略"

### Requirement: 资源监控和保护
系统 SHALL 监控内存使用，防止 OOM（Out of Memory）。

#### Scenario: 内存接近限制
- **WHEN** 内存使用超过 80% (约 5.6GB / 7GB)
- **THEN** 系统自动降低并发数（减半）
- **AND** 记录警告日志"内存压力大，降低并发"

#### Scenario: 批次处理完成释放资源
- **WHEN** 一批图片处理完成
- **THEN** 系统立即释放相关 Buffer
- **AND** 执行 manual GC（如果环境支持）

### Requirement: 错误不阻塞并发队列
系统 SHALL 确保单个任务失败不影响其他并发任务。

#### Scenario: 单张图片下载失败
- **WHEN** 批量处理中某张图片下载失败
- **THEN** 该图片使用占位符 URL
- **AND** 其他图片继续正常处理
- **AND** 记录错误但不抛出异常

#### Scenario: 整个章节处理失败
- **WHEN** 某个章节处理过程中发生错误
- **THEN** 记录错误日志
- **AND** 继续处理下一个章节
- **AND** 失败的章节状态保持未完成，下次重试
