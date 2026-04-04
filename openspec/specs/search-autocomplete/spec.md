# search-autocomplete

## 描述

搜索框实时自动补全，在用户输入时展示候选结果下拉列表。

## Requirements

- REQ-1: 搜索框输入后 MUST 在 300ms debounce 后触发补全请求
- REQ-2: 补全结果 MUST 分类展示（影片/演员/厂商），每类最多 3 条
- REQ-3: 点击候选项 MUST 直接跳转到对应详情页（不经过搜索结果页）
- REQ-4: 按 Enter 键 MUST 跳转到 `/search?q=<keyword>` 全结果页
- REQ-5: 按 Escape 或点击外部区域 MUST 关闭下拉列表
- REQ-6: 输入关键词少于 2 个字符时 SHALL 不触发补全请求
- REQ-7: 搜索框 MUST 集成到顶部导航，在所有页面可见
- REQ-8: 候选列表中演员条目 SHALL 展示头像缩略图（若有）
