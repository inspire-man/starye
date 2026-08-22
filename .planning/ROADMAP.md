# Roadmap: Starye

## 已完成

- v1.0：部署可用与日常使用态
- v1.1：存储成本控制与文档/代码整理
- v1.2：Cloudflare 账户/域名切换与发布验证
- v1.3：后台 crawler 任务与内容运维
- v1.4：播放可用性与生产自愈闭环
- v1.5：crawler 运管与视频/漫画内容可用性闭环

完整阶段证据位于 [`.planning/milestones/`](./milestones/)。

## 当前焦点

没有进行中的里程碑。下一项功能先在 [`openspec/`](../openspec/) 建立 change，再决定是否需要拆分多个实现阶段。

## 下一轮默认验收

- 相关自动化测试与 type-check/lint/build 通过。
- 浏览器路径经 `http://localhost:8080/...` 验证。
- crawler 或持久化改动包含 D1 authoritative readback。
- 生产行为使用新的 task/run/attempt/provider tuple，不复用历史证明。
