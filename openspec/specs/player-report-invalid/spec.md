# player-report-invalid

## 描述

允许用户对失效播放源进行上报，触发后端标记流程。

## Requirements

- REQ-1: 每个 player 卡片 MUST 提供"上报失效"入口（按钮或图标）
- REQ-2: 点击上报 MUST 弹出确认提示，防止误操作
- REQ-3: 确认后 MUST 调用 `POST /api/players/:id/report`，同一用户对同一 player 重复上报 SHALL 被后端幂等处理
- REQ-4: 上报成功后该 player 在当前会话中 MUST 显示"已上报"状态，并禁用再次上报按钮
- REQ-5: 后端 MUST 维护 `reportCount` 字段，超过阈值（如 5 次）时自动将 player 标记为待审核
- REQ-6: 未登录用户 SHALL 无法上报，点击时提示登录
