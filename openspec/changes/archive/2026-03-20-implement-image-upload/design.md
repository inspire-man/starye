## Context

当前 Dashboard 前端已实现 `ImageUpload.vue` 组件，在电影管理、演员管理等页面调用，但后端 `/api/upload` 路由仍是 TODO。项目已配置 Cloudflare R2 存储桶（在 `wrangler.toml` 中绑定），数据库 schema 中已定义 `media` 表用于记录图片元数据。需要实现完整的图片上传流程：从前端文件选择 → 后端验证 → R2 存储 → 返回 CDN URL。

## Goals / Non-Goals

**Goals:**
- 实现 `/api/upload` 端点，支持 multipart/form-data 图片上传
- 验证用户身份（仅管理员）、文件格式（JPEG/PNG/GIF/WebP）、文件大小（≤10MB）
- 上传文件到 Cloudflare R2，生成唯一 key
- 将元数据记录到 `media` 表
- 返回可公开访问的 CDN URL
- 前端 `ImageUpload.vue` 集成真实 API

**Non-Goals:**
- 图片压缩/缩略图生成（未来可考虑使用 Cloudflare Images）
- 批量上传（单次仅支持一个文件）
- 图片编辑功能（裁剪、滤镜等）
- 视频或其他非图片文件上传

## Decisions

### 决策 1：使用 Cloudflare R2 作为存储后端
**选择**: Cloudflare R2  
**替代方案**: S3、Cloudinary、本地文件系统  
**理由**:
- 项目已部署在 Cloudflare Workers，R2 与 Workers 原生集成，无需跨云调用
- R2 费用低（仅存储费用，出站流量免费）
- 通过 R2 public bucket 或 custom domain 可实现 CDN 加速
- 避免维护独立的对象存储服务

### 决策 2：文件 Key 生成策略
**格式**: `images/<timestamp>-<nanoid>.<ext>`  
**示例**: `images/1710856234567-V1StGXR8_Z5jdHi6B-myT.jpg`  
**理由**:
- timestamp 前缀便于按时间排序和管理
- nanoid 保证全局唯一性（21 字符，碰撞概率极低）
- 保留原始扩展名便于浏览器识别 MIME 类型
- 避免文件名冲突和路径注入攻击

**替代方案考虑**:
- UUID v4：较长（36 字符），nanoid 更短更友好
- 哈希原文件内容：需要读取整个文件，性能开销大且用户可能上传相同内容的不同图片

### 决策 3：MIME 类型验证策略
**方法**: 检查 `Content-Type` header + 文件扩展名  
**理由**:
- Cloudflare Workers 中无法使用 `file-type` 等需要读取文件头的库（依赖 Node.js Buffer）
- 仅验证扩展名不安全（可伪造）
- 结合 Content-Type header 和扩展名白名单可覆盖大部分场景
- 浏览器上传时会自动设置正确的 Content-Type

**接受的风险**:
- 如果用户使用工具伪造 Content-Type header，仍可能上传非图片文件
- 缓解措施：前端 `ImageUpload.vue` 已使用 `accept="image/*"` 限制文件选择器；后端限制文件大小减少滥用风险

### 决策 4：R2 Public URL 配置
**方法**: 配置 R2 bucket 的 public access + custom domain  
**步骤**:
1. 在 Cloudflare Dashboard 中为 R2 bucket 开启 public access
2. 配置 custom domain（如 `cdn.starye.com`）指向 R2 bucket
3. 环境变量 `R2_PUBLIC_URL` 存储 CDN 域名

**理由**:
- R2 默认 URL 格式为 `https://<account-id>.r2.cloudflarestorage.com/<bucket>/<key>`，不友好且泄露账户信息
- Custom domain 提供更好的品牌体验和 CDN 缓存策略
- 分离存储层和访问层，便于未来迁移

### 决策 5：数据库与 R2 的一致性策略
**策略**: R2 上传成功后写入数据库，数据库写入失败不回滚 R2  
**理由**:
- Cloudflare Workers 不支持分布式事务
- R2 上传是幂等操作（相同 key 会覆盖）
- 数据库写入失败时记录错误日志，但文件已可访问（可接受）
- 未来可通过定期扫描 R2 与数据库差异进行修复

**替代方案考虑**:
- 先写数据库再上传 R2：如果 R2 失败会留下数据库孤儿记录，更难清理
- 使用 Cloudflare Queue 异步写入：增加复杂度，对于管理端上传场景非必需

### 决策 6：前端上传流程
**方法**: 使用 `FormData` + `fetch` API  
**流程**:
1. 用户选择文件 → `ImageUpload.vue` 触发 `@change` 事件
2. 创建 `FormData`，添加文件字段 `file`
3. 调用 `api.upload(formData)` → `POST /api/upload`
4. 显示上传进度（可选，使用 `XMLHttpRequest` 或 `fetch` with `ReadableStream`）
5. 成功后更新 `v-model` 绑定的 URL

**理由**:
- FormData 是浏览器原生支持的文件上传方式
- Dashboard 已使用 `fetchApi` 封装统一的鉴权和错误处理
- 保持与现有 API 调用模式一致

## Risks / Trade-offs

### 风险 1：R2 费用增长
**风险**: 如果大量图片上传，R2 存储费用可能显著增加  
**缓解**:
- 初期仅管理员可上传，流量可控
- 监控 R2 使用量，设置 Cloudflare 账户预算告警
- 未来可考虑实施图片压缩或定期清理未使用图片

### 风险 2：文件大小限制绕过
**风险**: 恶意用户可能使用工具绕过前端限制，上传大文件  
**缓解**:
- 后端严格验证 `Content-Length` header，超过 10MB 立即拒绝
- Cloudflare Workers 本身限制请求体大小（免费版 100MB，付费版可调整）
- 限制管理员账号数量，降低滥用风险

### 风险 3：MIME 类型伪造
**风险**: 攻击者伪造 Content-Type header 上传恶意文件  
**缓解**:
- 结合扩展名白名单（.jpg, .jpeg, .png, .gif, .webp）
- R2 存储时强制设置 Content-Type（避免浏览器自动执行脚本）
- 未来可考虑集成 Cloudflare Images 自动验证和转换

### Trade-off 1：无缩略图生成
**限制**: 上传的原图直接使用，可能影响页面加载速度  
**理由**: Cloudflare Images 需要付费计划，初期使用原图可控  
**未来优化**: 集成 Cloudflare Images 或在上传时生成多尺寸变体

### Trade-off 2：数据库与 R2 最终一致性
**限制**: R2 上传成功但数据库写入失败时，文件可访问但无记录  
**理由**: Cloudflare Workers 无分布式事务支持，接受此风险  
**监控**: 记录错误日志，定期检查不一致情况

## Migration Plan

### 部署前准备
1. **配置 R2 Bucket**:
   - 在 Cloudflare Dashboard 创建 R2 bucket（如已存在则跳过）
   - 启用 public access
   - 配置 custom domain（如 `cdn.starye.com`）并验证 DNS

2. **环境变量配置**:
   - 在 Cloudflare Workers 设置中添加环境变量：
     ```bash
     R2_PUBLIC_URL=https://cdn.starye.com
     ```

3. **更新 wrangler.toml**:
   ```toml
   [[r2_buckets]]
   binding = "R2"
   bucket_name = "starye-media"
   ```

### 部署步骤
1. 提交代码变更并推送到 main 分支
2. GitHub Actions 自动部署 API Worker
3. 验证 `/api/upload` 端点可访问（返回 401 未认证）

### 验证测试
1. 登录 Dashboard，进入电影管理页面
2. 点击编辑电影，尝试上传封面图
3. 确认图片成功上传并显示预览
4. 检查 R2 bucket 中是否存在对应文件
5. 查询 `media` 表确认记录已创建

### 回滚策略
- 如果上传功能异常，前端 `ImageUpload.vue` 仍允许手动输入 URL
- 后端问题可通过 Cloudflare Workers 版本回滚
- R2 已上传的文件不会影响现有功能（可手动清理）

## Open Questions

1. **是否需要支持图片删除**?
   - 当前设计仅实现上传，删除 media 记录时是否同步删除 R2 文件？
   - 建议：初期不实现自动删除，定期手动清理；未来可添加软删除机制

2. **是否需要记录上传者**?
   - 当前 `media` 表无 `uploadedBy` 字段，是否需要审计功能？
   - 建议：如需审计可复用 `auditLogs` 表记录上传操作

3. **CDN 缓存策略**?
   - R2 custom domain 的缓存 TTL 如何配置？
   - 建议：初期使用 Cloudflare 默认缓存策略（通常 4 小时），未来可通过 Page Rules 调整
