## 1. 后端 API 实现 - 路由和验证

- [x] 1.1 创建 `apps/api/src/routes/upload.ts` 文件，定义 `/upload` POST 端点
- [x] 1.2 添加身份验证中间件，使用 `serviceAuth(['admin', 'comic_admin', 'movie_admin'])` 限制访问
- [x] 1.3 实现请求体解析，使用 `c.req.parseBody()` 获取 `FormData` 中的 `file` 字段
- [x] 1.4 添加文件格式验证：检查 `Content-Type` 是否为 `image/jpeg|png|gif|webp`，不符合则返回 400 错误
- [x] 1.5 添加文件扩展名验证：提取 `filename` 扩展名，白名单限制为 `.jpg|.jpeg|.png|.gif|.webp`
- [x] 1.6 添加文件大小验证：检查 `file.size` 是否 ≤ 10MB（10 * 1024 * 1024 bytes），超出则返回 413 错误

## 2. 后端 API 实现 - R2 存储

- [x] 2.1 从环境变量获取 R2 绑定：`const r2 = c.env.R2`，若未配置则返回 500 错误
- [x] 2.2 生成唯一文件 key：使用格式 `images/${Date.now()}-${nanoid()}.${ext}`
- [x] 2.3 上传文件到 R2：调用 `r2.put(key, file.stream(), { httpMetadata: { contentType: file.type } })`
- [x] 2.4 处理 R2 上传错误：捕获异常，记录日志，返回 500 错误
- [x] 2.5 构建 CDN URL：从环境变量 `R2_PUBLIC_URL` 读取域名，拼接为 `${R2_PUBLIC_URL}/${key}`

## 3. 后端 API 实现 - 数据库记录

- [x] 3.1 插入 `media` 表记录：使用 Drizzle 插入 `{ id: nanoid(), key, url, mimeType, size, createdAt: new Date() }`
- [x] 3.2 处理数据库插入错误：捕获异常并记录日志，但不回滚 R2（接受最终一致性）
- [x] 3.3 返回成功响应：返回 JSON `{ id, url, key, size, mimeType }` 和 200 状态码
- [x] 3.4 在 `apps/api/src/index.ts` 中注册路由：`app.route('/api/upload', uploadRouter)`

## 4. 前端 Dashboard 集成

- [x] 4.1 在 `apps/dashboard/src/lib/api.ts` 添加上传方法：`export async function uploadImage(file: File): Promise<{ id: string, url: string }>`
- [x] 4.2 实现 `uploadImage` 方法：创建 `FormData`，添加 `file` 字段，调用 `fetchApi('/upload', { method: 'POST', body: formData })`
- [x] 4.3 修改 `apps/dashboard/src/components/ImageUpload.vue` 的 `handleUpload` 方法，调用 `api.uploadImage(file)` 替换 TODO
- [x] 4.4 添加上传中状态：在 `ImageUpload.vue` 中添加 `uploading` ref，上传时显示加载指示器
- [x] 4.5 添加错误处理：捕获上传失败异常，使用 `alert()` 或 Toast 显示错误消息
- [x] 4.6 上传成功后更新图片 URL：调用 `emit('update:modelValue', response.url)` 更新父组件绑定值

## 5. 类型定义和导出

- [x] 5.1 在 `apps/dashboard/src/lib/api.ts` 添加上传响应类型：`export interface UploadResponse { id: string, url: string, key: string, size: number, mimeType: string }`
- [x] 5.2 在 `apps/api/src/routes/upload.ts` 中添加 Zod schema 验证文件字段（可选，增强类型安全）
- [x] 5.3 添加 TypeScript 类型注释确保 `file` 对象类型正确（Hono 的 `c.req.parseBody()` 返回类型）

## 6. 配置和环境变量

- [x] 6.1 验证 `apps/api/wrangler.toml` 中 R2 绑定配置：确认 `[[r2_buckets]]` 段存在且 `binding = "R2"`
- [x] 6.2 在 Cloudflare Workers 设置中添加环境变量 `R2_PUBLIC_URL`（如 `https://cdn.starye.com`）
- [x] 6.3 验证 R2 bucket 已启用 public access 或配置 custom domain
- [x] 6.4 更新 `.env.example` 文件（如果有）添加 `R2_PUBLIC_URL` 示例

## 7. 测试和验证

- [ ] 7.1 本地测试：启动 Dashboard 开发服务器，尝试在电影管理页面上传图片
- [ ] 7.2 验证上传流程：确认图片上传后 Dashboard 显示预览
- [ ] 7.3 检查 R2 bucket：在 Cloudflare Dashboard 查看文件是否成功上传
- [ ] 7.4 检查数据库：查询 `media` 表确认记录已创建
- [ ] 7.5 测试错误场景：尝试上传超大文件（>10MB）、非图片文件，验证返回正确错误
- [ ] 7.6 测试权限控制：未登录或普通用户访问 `/api/upload` 应返回 401/403 错误

## 8. 代码质量和清理

- [x] 8.1 运行 `pnpm lint:fix` 修复代码风格问题
- [x] 8.2 运行 `pnpm type-check` 验证 TypeScript 类型正确
- [x] 8.3 添加必要的代码注释，说明关键逻辑（如 key 生成策略、错误处理）
- [x] 8.4 移除 `ImageUpload.vue` 中的 TODO 注释和 console.log 调试代码

## 9. 部署和文档

- [ ] 9.1 提交代码变更并推送到 main 分支
- [ ] 9.2 等待 GitHub Actions 自动部署完成
- [ ] 9.3 在生产环境验证上传功能正常工作
- [x] 9.4 更新项目 README 或内部文档，说明图片上传功能已可用
