# movie-media-integrity Specification

## Purpose
TBD - created by archiving change 2026-09-10-movie-media-integrity. Update Purpose after archive.

## Requirements

### Requirement: 媒体完整性分类
系统 MUST 对电影封面、预览图和演员头像分别返回存储态 `missing_value`、`external_url`、`invalid_url`、`managed`，以及回填探测态 `http_probe_failed`、`non_image`、`image_decode_failed`、`source_unavailable`。

#### Scenario: 空值与外部 URL 可区分
- **WHEN** 资源为空或为非托管 URL
- **THEN** API 返回对应分类，不合并为单一缺失状态

### Requirement: 回填批次摘要
系统 MUST 返回最近回填批次及成功、失败、跳过、重试和失败原因统计。电影 crawler 成功 receipt MUST 持久化 `mediaFailureReasons`，管理端摘要 MUST 来自 D1 receipt readback。

#### Scenario: 任务完成后读取摘要
- **WHEN** 管理端请求媒体完整性摘要
- **THEN** 响应来自 D1 持久化任务/receipt readback，并包含批次时间和状态

### Requirement: 统一客户端状态
MovieCard、MovieDetail 和 ActorDetail MUST 使用同一媒体状态字段决定展示图片、占位符和提示。

#### Scenario: 统一状态渲染
- **WHEN** 客户端读取媒体状态
- **THEN** 图片、占位符和提示使用同一分类

### Requirement: 保护已知可用媒体
回填或同步得到空值、非图片或来源暂不可用时 MUST 保留已有托管媒体。

#### Scenario: 异常结果不覆盖托管媒体
- **WHEN** 新一轮回填没有得到可信图片
- **THEN** 已有托管 URL 保持不变，并记录失败原因
