## 修复边界

1. crawler 从 existing-chapters 与当前源章节交集计算进度；源重复行保留在快照，但执行按 slug 去重。
2. API 对已爬数量大于总数、未齐却标 complete 的请求拒绝写入。
3. admin/public/service 的章节读取统一使用 sortOrder、chapterNumber、id 稳定排序。
4. Movie 完整性验收区分匿名播放器隐藏、数据缺口和实际媒体可用性；历史数据不做未经源核实的合并。
