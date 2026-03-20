# image-upload Specification

## Purpose
TBD - created by archiving change implement-image-upload. Update Purpose after archive.
## Requirements
### Requirement: 上传接口身份验证
上传接口 **MUST** 验证用户身份，仅允许具有管理员角色（admin、super_admin、comic_admin、movie_admin）的用户访问。

#### Scenario: 未认证用户上传
- **WHEN** 未登录用户尝试上传图片
- **THEN** 系统返回 401 Unauthorized 错误

#### Scenario: 普通用户上传
- **WHEN** 已登录但角色为普通用户尝试上传图片
- **THEN** 系统返回 403 Forbidden 错误

#### Scenario: 管理员用户上传
- **WHEN** 具有管理员角色的用户上传图片
- **THEN** 系统接受上传请求并处理

### Requirement: 文件格式验证
系统 **SHALL** 仅接受图片文件，支持的格式包括 JPEG、PNG、GIF、WebP。

#### Scenario: 上传支持的图片格式
- **WHEN** 用户上传 JPEG/PNG/GIF/WebP 格式的图片
- **THEN** 系统接受并处理该文件

#### Scenario: 上传不支持的文件类型
- **WHEN** 用户上传非图片文件（如 PDF、TXT）
- **THEN** 系统返回 400 Bad Request 错误，提示 "Unsupported file type"

#### Scenario: MIME 类型伪造检测
- **WHEN** 用户上传文件扩展名为 .jpg 但实际 MIME 类型不匹配
- **THEN** 系统返回 400 Bad Request 错误

### Requirement: 文件大小限制
系统 **SHALL** 限制单个图片文件大小不超过 10MB。

#### Scenario: 上传小于限制的文件
- **WHEN** 用户上传 5MB 的图片
- **THEN** 系统接受并处理该文件

#### Scenario: 上传超过限制的文件
- **WHEN** 用户上传 15MB 的图片
- **THEN** 系统返回 413 Payload Too Large 错误

### Requirement: R2 存储唯一标识
系统 **MUST** 为每个上传的文件生成唯一的存储 key，格式为 `images/<timestamp>-<nanoid>.<ext>`。

#### Scenario: 生成唯一 key
- **WHEN** 用户上传文件 avatar.jpg
- **THEN** 系统生成 key 如 `images/1710856234567-abc123xyz.jpg` 并存储到 R2

#### Scenario: 相同文件名不冲突
- **WHEN** 两个用户同时上传名为 avatar.jpg 的文件
- **THEN** 系统为每个文件生成不同的唯一 key

### Requirement: 公共 URL 返回
系统 **SHALL** 将文件上传到 R2 后，返回可公开访问的 CDN URL。

#### Scenario: 上传成功返回 URL
- **WHEN** 文件成功上传到 R2
- **THEN** 系统返回包含 CDN URL 的响应，格式如 `https://cdn.example.com/images/xxx.jpg`

#### Scenario: URL 立即可访问
- **WHEN** 系统返回 CDN URL
- **THEN** 该 URL 可立即通过 HTTP GET 访问图片

### Requirement: 元数据记录
系统 **MUST** 将上传的图片元数据存入 `media` 表，包括 key、URL、文件大小、MIME 类型。

#### Scenario: 元数据完整性
- **WHEN** 文件上传成功
- **THEN** 系统在 `media` 表创建记录，包含以下字段：id, key, url, mimeType, size, createdAt

#### Scenario: 存储失败回滚
- **WHEN** R2 存储成功但数据库写入失败
- **THEN** 系统记录错误日志，但不回滚 R2 上传（因为 Cloudflare Workers 不支持分布式事务）

### Requirement: 错误处理与日志
系统 **SHALL** 对上传失败的情况返回明确的错误信息，并记录服务端日志。

#### Scenario: R2 连接失败
- **WHEN** R2 bucket 不可用或配置错误
- **THEN** 系统返回 500 Internal Server Error，并记录错误日志到 console

#### Scenario: 客户端接收错误信息
- **WHEN** 任何上传步骤失败
- **THEN** 系统返回 JSON 格式错误响应，包含 `{ error: "<错误描述>" }` 字段

### Requirement: API 响应格式
系统 **MUST** 遵循统一的 API 响应格式。

#### Scenario: 上传成功响应
- **WHEN** 文件上传成功
- **THEN** 系统返回 JSON: `{ id: "<media-id>", url: "<cdn-url>", key: "<r2-key>", size: <bytes>, mimeType: "<type>" }`

#### Scenario: 上传失败响应
- **WHEN** 上传失败（如格式不支持）
- **THEN** 系统返回 JSON: `{ error: "<错误消息>" }` 及对应 HTTP 状态码

