## Why

Dashboard 前端已实现 `ImageUpload` 组件，在电影管理、演员管理等多个页面中使用，但后端上传接口仍是 TODO 状态。当前管理员无法上传电影封面、演员头像等图片资源，只能依赖爬虫抓取的图片，严重限制了内容管理的灵活性。项目已配置 Cloudflare R2 存储桶，现在需要实现完整的图片上传能力，打通前后端流程。

## What Changes

- **新增上传 API**：在 `apps/api` 中实现 `/api/upload` 路由，支持图片文件上传到 Cloudflare R2
- **R2 存储集成**：配置 R2 绑定，实现文件上传、生成唯一 key、返回 CDN URL
- **元数据记录**：将上传的图片信息（key、URL、大小、MIME 类型）存入 `media` 表
- **前端集成**：修改 Dashboard 中 `ImageUpload` 组件的 `@upload` 事件处理，调用真实 API 并更新图片 URL
- **BREAKING**: 图片上传 **MUST** 经过身份验证，仅管理员角色（admin、super_admin、comic_admin、movie_admin）可访问

## Capabilities

### New Capabilities
- `image-upload`: 图片上传到 Cloudflare R2 的能力，包括文件验证、存储、URL 生成和元数据记录

### Modified Capabilities
<!-- 无现有能力的需求变更 -->

## Impact

**代码变更**:
- `apps/api/src/routes/upload.ts`: 新增文件，实现上传路由
- `apps/api/src/index.ts`: 注册 `/api/upload` 路由
- `apps/dashboard/src/components/ImageUpload.vue`: 连接真实上传 API
- `apps/dashboard/src/lib/api.ts`: 添加上传接口类型定义

**基础设施**:
- Cloudflare R2 绑定配置（`wrangler.toml` 中已配置 `R2` bucket）
- 环境变量：R2 Public URL 配置（CDN 域名）

**数据库**:
- 使用现有的 `media` 表（schema 已定义）

**部署影响**:
- 需要确保 R2 bucket 权限正确配置
- API Worker 重新部署后生效

**风险**:
- 上传文件大小限制（Cloudflare Workers 请求体限制 100MB）
- R2 费用（存储和请求成本）
- 图片格式验证不足可能导致安全问题
