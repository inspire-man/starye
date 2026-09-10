# 设计

- 以现有 movie、actor、media 和 crawler receipt 为基础，先提供只读完整性聚合接口。
- 完整性分类固定为 `missing_value`、`external_url`、`probe_failed`、`non_image`、`source_unavailable`、`managed`。
- 回填批次摘要从任务 receipt 聚合成功、失败、跳过、重试及原因，并通过 D1 readback 返回。
- Dashboard Movies 页面展示摘要、分类筛选和最近批次；MovieCard、MovieDetail、ActorDetail 使用统一媒体状态字段。
- 不因单次空结果覆盖已有托管媒体。
