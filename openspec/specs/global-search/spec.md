# global-search

## 描述

跨类型统一搜索能力，支持同时搜索影片、演员、厂商，结果分组展示，搜索状态 URL 化。

## Requirements

- REQ-1: 后端 `GET /api/search?q=&types=` 端点 MUST 返回分组结果 `{ movies[], actors[], publishers[] }`
- REQ-2: 影片搜索 MUST 同时匹配 `title LIKE %q%` 和 `code = q`（精确番号查询优先）
- REQ-3: 搜索结果 MUST 遵循 R18 过滤规则（未验证用户不返回 R18 影片）
- REQ-4: 前端 `/search` 页面 MUST 将搜索关键词同步到 URL query `?q=`，支持浏览器前进后退
- REQ-5: 搜索结果页 MUST 按类型分组展示，每组显示结果数量
- REQ-6: 关键词为空时 MUST 返回空结果而非报错
- REQ-7: 搜索结果中每个影片卡片 MUST 可点击跳转到 `/movie/:code`，演员跳转 `/actors/:slug`，厂商跳转 `/publishers/:slug`
