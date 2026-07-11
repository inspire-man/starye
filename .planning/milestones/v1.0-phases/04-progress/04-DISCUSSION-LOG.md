# Phase 4: 统一 Progress 表 + 漫画阅读/视频观看进度 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 04-统一 Progress 表 + 漫画阅读/视频观看进度
**Areas discussed:** 历史保留与旧数据迁移, 视频看完规则, 漫画章节完成后的重开行为, 进度入口的登录门控形态, 影片进度作用域, 极短进度是否自动恢复, 无 duration 的影片怎么判定已看完, TorrServer / streamUrl 直达播放是否纳入统一进度

---

## 历史保留与旧数据迁移

| Option | Description | Selected |
|--------|-------------|----------|
| 保留并迁移 | 新建统一表并迁移旧 reading / watching 记录 | |
| 只做运行时兼容，不做一次性迁移 | 新表上线后按需读旧表兜底 | |
| 直接切新表，旧数据不要了 | clean cutover，不保留旧进度 | ✓ |

**User's choice:** 直接切新表，旧数据不要了  
**Notes:** 后续补充决定为：旧 API / 旧表 / 旧前端调用一步到位清掉；不做迁移公告；Phase 4 同期删旧表。

---

## 视频看完规则

| Option | Description | Selected |
|--------|-------------|----------|
| 保持现在的 90% | 延续现有 history / continue 语义 | ✓ |
| 提高到 95% | 更保守地判定看完 | |
| 只有播放到 ended 才算完成 | 仅靠显式播放结束判定 | |

**User's choice:** 保持现在的 90%  
**Notes:** 后续补充决定为：已看完再次打开从头开始；重新开始播放时立刻清掉 `completed`；已看完仍保留在历史中，只从“继续观看”里排除。

---

## 漫画章节完成后的重开行为

| Option | Description | Selected |
|--------|-------------|----------|
| 回到第一页 | 已完成章节重开按重读处理 | ✓ |
| 停在最后一页 | 继续停留在完成位置 | |
| 回到倒数几页 | 用一个回退区间做折中 | |

**User's choice:** 回到第一页  
**Notes:** 后续补充决定为：完成时仍记录最后一页；重新开始阅读时立刻清掉 `completed`；已完成章节仍保留在阅读历史中。

---

## 进度入口的登录门控形态

| Option | Description | Selected |
|--------|-------------|----------|
| 入口可见，但点击时跳登录 | 让匿名用户知道能力存在，但触达即门控 | ✓ |
| 匿名用户直接隐藏这些入口 | UI 最简，但能力不可见 | |
| 入口可见但置灰，附带登录后可用提示 | 需要额外 disabled 交互与文案 | |

**User's choice:** 入口可见，但点击时跳登录  
**Notes:** 后续补充决定为：匿名用户直接访问进度页时进入前就重定向到登录页；Phase 4 只收口入口与页面级门控；现有 toast 阻断统一改成 `next` 登录跳转。

---

## 影片进度作用域

| Option | Description | Selected |
|--------|-------------|----------|
| 按影片共享一个进度 | 同影片不同播放源共用同一进度 | ✓ |
| 按播放源分别记录进度 | 每个源各自维护位置 | |
| 只有明确可替代的源共享，其他源分开 | 需要额外分类规则 | |

**User's choice:** 按影片共享一个进度  
**Notes:** 后续补充决定为：切源后也恢复共享进度；历史按影片始终只保留一条；Phase 4 不记录最近使用源。

---

## 极短进度是否自动恢复

| Option | Description | Selected |
|--------|-------------|----------|
| 小于 30 秒不恢复 | 过滤试播 / 误触噪音 | ✓ |
| 只要大于 0 秒就恢复 | 完全沿用当前行为 | |
| 小于 60 秒不恢复 | 更保守，但更容易误伤真实观看 | |

**User's choice:** 按推荐选项自动采用  
**Notes:** 用户明确授权“后续问题都可以使用你的推荐选项”。因此此 area 自动锁定为：小于 30 秒不恢复，且低于 30 秒直接不写统一表。

---

## 无 duration 的影片怎么判定已看完

| Option | Description | Selected |
|--------|-------------|----------|
| 不要，取消 3600 秒推断，统一依赖显式 completed 标记 | 去掉猜测性完成规则 | ✓ |
| 要，继续保留 progress >= 3600 秒的推断 | 延续现有 history fallback | |
| duration 缺失时永远不能进入已看完 | 过于依赖元数据完整性 | |

**User's choice:** 按推荐选项自动采用  
**Notes:** 统一表完成判定不再依赖 `progress >= 3600` 这种旧 fallback。

---

## TorrServer / streamUrl 直达播放是否纳入统一进度

| Option | Description | Selected |
|--------|-------------|----------|
| 要，纳入同一套 movie 级进度模型 | 可信 `streamUrl` 也使用统一恢复 / 保存语义 | ✓ |
| 不要，继续排除 streamUrl 路径 | 保持当前特殊分支 | |
| 只恢复不写入 | 行为不对称，语义更复杂 | |

**User's choice:** 按推荐选项自动采用  
**Notes:** 自动锁定为：可信 TorrServer / `streamUrl` 路径纳入统一 movie progress，并沿用同一套 30 秒阈值与 completed 规则。

---

## the agent's Discretion

- 统一 `progress` 表的具体列名与 API 组织形式交由 planner 决定
- “重新开始就立即清掉 completed”的精确事件钩子交由 planner 结合现有事件流选择

## Deferred Ideas

- Phase 4 不新增 comic 首页“继续阅读”横幅或独立 comic 历史页
- Phase 4 不记录最近使用的播放源，也不做按源偏好恢复
- `duration` 缺失的数据质量问题留给后续 metadata / crawler 改善，而不是继续在历史页硬编码猜测规则
