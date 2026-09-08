## Context

Comic 已有 R18 目录过滤/封面清理。Movie 的两个路由族共享详情服务，但列表和推荐各自构建响应；旧列表的公共缓存会跨会话复用响应。

## Goals / Non-Goals

统一 Movie 应用图片展示与已有播放权限。保持目录文字、分页、普通内容和已有认证逻辑。CDN 私有化及签名媒体分发不在本次范围内。

## Decisions

- 服务端以现有 checkUserAdultStatus 判定权限；封面为 null、预览为 []，保留字段形状。
- 关联电影独立判断 isR18；原始数据库对象保持不变。
- 两个电影路由族及演员详情使用 private, no-store 并按 Cookie 区分响应，移除旧电影列表/详情及演员详情 Cache API 接入。Gateway 对电影 API 绕过已有 KV 条目。
- 前端详情与列表在图片渲染边界增加 R18 判定，详情提供权限占位提示。

## Risks / Trade-offs

电影 API 放弃共享响应缓存以消除身份切换后的受限图片复用；Gateway 对匿名与认证电影请求都绕过缓存。已有公开 CDN URL 的访问控制需要独立的存储迁移。

## Validation

服务/路由回归、缓存响应头、前端受限图片 DOM、API/Movie 类型检查以及 Gateway 匿名 API/页面验收。
