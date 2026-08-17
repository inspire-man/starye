---
quick: 260817-manga-source-top
date: 2026-08-17
status: in-progress
---

# 更换漫画爬虫来源

## Scope

- 将漫画任务入口从 `https://www.92hm.life` 切换到已验证的 `https://www.92hm.top`。
- 保留旧域名识别兼容，避免历史链接无法被策略识别。
- 为新入口补充回归断言，验证详情页、章节页和图片 URL 仍符合现有解析器契约。

## Verification

- crawler 定向 parser/strategy 测试
- crawler type-check
- `git diff --check`
- GitNexus detect-changes
- 提交后重新触发漫画生产爬虫并检查任务结果
