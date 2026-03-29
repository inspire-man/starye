## Context

当前影片详情页（`apps/movie-app/src/views/MovieDetail.vue`）展示了影片的基本信息、女优、厂商等内容，但缺少播放源信息的展示。数据库中 `players` 表已存储播放源数据，包括在线播放链接和磁力链接，但前端未读取和渲染。

用户当前需要手动在外部网站搜索磁链，然后在下载工具中管理下载任务，体验割裂。此变更旨在将播放源信息集成到影片详情页，并提供便捷的磁链管理功能。

**技术约束：**
- 前端使用 Vue 3 Composition API，遵循 `<script setup>` 风格
- API 已通过 `movieApi.getMovieDetail()` 返回影片数据，需确认是否包含播放源
- 使用浏览器原生 API（Clipboard API、localStorage）避免引入额外依赖
- 必须支持响应式布局，兼容移动端和桌面端

## Goals / Non-Goals

**Goals:**
- 在影片详情页展示所有播放源（在线播放、磁力链接）
- 实现磁链一键复制功能，使用 Clipboard API
- 支持 magnet:// 协议调用系统默认 BT 客户端
- 提供下载列表管理功能，数据存储在 localStorage
- 优化播放源排序逻辑，优先展示高质量资源

**Non-Goals:**
- 不集成 Aria2 或其他第三方下载工具（作为 Phase 3 后续功能）
- 不实现在线播放器功能（保持现有行为）
- 不提供磁链有效性验证（数据质量问题由爬虫层面解决）
- 不实现跨设备下载列表同步（localStorage 限制）

## Decisions

### 决策 1：播放源数据获取方式

**选择：** 扩展现有 `movieApi.getMovieDetail()` API，确保返回播放源数据

**理由：**
- 现有 API 已返回影片详情，添加播放源字段是最小改动
- 避免增加额外的 API 请求，减少网络开销
- 后端 `apps/api/src/routes/movies.ts` 中已有 players 表查询逻辑（需确认）

**替代方案（已拒绝）：**
- 方案 A：新增 `GET /api/movies/:code/players` 独立接口
  - 缺点：增加额外请求，前端需要管理多个加载状态
- 方案 B：前端直接查询数据库
  - 缺点：违反架构分层，前端不应直接访问数据库

**实施细节：**
- 检查 API 响应格式，确认 `players` 字段是否存在
- 如果不存在，修改后端查询逻辑，关联查询 players 表
- 播放源数据结构：`{ id, sourceName, sourceUrl, quality, sortOrder }`

### 决策 2：磁链复制实现方案

**选择：** 使用浏览器 Clipboard API + 降级到 fallback 方案

**理由：**
- Clipboard API 是现代浏览器标准，体验流畅
- 支持异步复制，无需用户交互触发
- 提供降级方案确保兼容性

**替代方案（已拒绝）：**
- 方案 A：仅使用 `document.execCommand('copy')`（已废弃）
  - 缺点：API 已被废弃，未来可能不可用
- 方案 B：使用第三方库（如 clipboard.js）
  - 缺点：引入额外依赖，增加打包体积

**实施细节：**
```typescript
// 主流程：Clipboard API
async function copyMagnetLink(magnetUrl: string) {
  try {
    await navigator.clipboard.writeText(magnetUrl)
    showToast('已复制到剪贴板')
  } catch (error) {
    // 降级：选中文本方式
    fallbackCopy(magnetUrl)
  }
}

// 降级方案
function fallbackCopy(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
  showToast('请按 Ctrl+C 复制')
}
```

### 决策 3：下载列表存储方案

**选择：** 使用浏览器 localStorage，前端独立管理

**理由：**
- 无需后端开发，实现快速
- 适合个人使用场景，无跨设备同步需求
- localStorage API 简单稳定，兼容性好
- 避免增加数据库表和 API 端点

**替代方案（已拒绝）：**
- 方案 A：后端数据库存储（新增 `user_downloads` 表）
  - 优点：支持跨设备同步
  - 缺点：增加后端开发工作量，需要 CRUD API
- 方案 B：IndexedDB 存储
  - 优点：容量更大，支持复杂查询
  - 缺点：API 复杂度高，实现成本大

**实施细节：**
- localStorage key: `starye:download-list`
- 数据结构：
```typescript
interface DownloadListItem {
  movieId: string
  movieCode: string
  title: string
  coverImage: string
  magnetLink?: string  // 用户选择的磁链
  status: 'planned' | 'downloading' | 'completed'
  addedAt: number  // timestamp
}
```
- 容量限制：100个影片（约 50KB），超过提示用户清理

### 决策 4：播放源区块位置

**选择：** 在影片详情页主要信息区块下方，相关影片上方

**理由：**
- 符合用户视觉流：基本信息 → 播放源 → 相关推荐
- 播放源是核心功能，应在首屏或次屏可见
- 避免打乱现有布局结构，减少改动范围

**UI 结构：**
```
影片详情页
├─ 封面 + 基本信息（现有）
├─ 演员、制作商、标签（现有）
├─ 简介（现有）
├─ ⭐ 播放源区块（新增）
│  ├─ 标题："播放源"
│  ├─ 播放源列表
│  │  ├─ [磁力] 高清 1080P [复制] [打开]
│  │  ├─ [磁力] 标清 720P [复制] [打开]
│  │  └─ [在线] 云播放器 [播放]
│  └─ [复制全部磁链] [添加到下载列表]
└─ 相关影片（现有）
```

### 决策 5：播放源排序策略

**选择：** 多维度排序：类型 > 画质 > 创建时间

**理由：**
- 用户偏好磁力下载优于在线播放（可控性强）
- 画质是影响用户选择的关键因素
- 相同条件下，最新的源更可能有效

**排序权重：**
1. 类型优先级：磁力链接 > 在线播放 > 其他
2. 画质优先级：4K > 1080P (HD) > 720P (SD) > 其他
3. 时间：创建时间降序

**实施代码：**
```typescript
function sortPlaybackSources(sources: Player[]) {
  const typeWeight = { 'magnet': 3, 'online': 2, 'other': 1 }
  const qualityWeight = { '4K': 4, '1080P': 3, 'HD': 3, '720P': 2, 'SD': 2 }
  
  return sources.sort((a, b) => {
    // 1. 类型排序
    const typeA = a.sourceName.includes('磁力') ? 'magnet' : 'online'
    const typeB = b.sourceName.includes('磁力') ? 'magnet' : 'online'
    if (typeWeight[typeA] !== typeWeight[typeB]) {
      return typeWeight[typeB] - typeWeight[typeA]
    }
    
    // 2. 画质排序
    const qualityA = qualityWeight[a.quality] || 0
    const qualityB = qualityWeight[b.quality] || 0
    if (qualityA !== qualityB) {
      return qualityB - qualityA
    }
    
    // 3. 时间排序
    return b.createdAt - a.createdAt
  })
}
```

## Risks / Trade-offs

### 风险 1：Clipboard API 权限问题

**风险：** 部分浏览器或 HTTPS 环境限制，可能导致复制功能失败

**缓解措施：**
- 实现 fallback 方案（execCommand + textarea）
- 在控制台记录错误信息，方便调试
- 在 UI 上提供明确的错误提示

### 风险 2：localStorage 容量限制

**风险：** localStorage 通常限制 5-10MB，大量数据可能超限

**缓解措施：**
- 限制下载列表最多 100 个影片
- 超过限制时提示用户清理旧数据
- 仅存储必要字段（不存储完整影片对象）

### 风险 3：磁链格式兼容性

**风险：** 爬虫抓取的磁链格式可能不标准，导致无法正常调用

**缓解措施：**
- 前端进行基础格式验证（正则匹配 `magnet:?xt=urn:btih:`）
- 对格式错误的链接显示警告，但不阻断渲染
- 在控制台记录格式错误的磁链，方便后续数据清理

### 风险 4：移动端体验

**风险：** 移动端无法直接调用 BT 客户端，magnet:// 协议可能无效

**缓解措施：**
- 移动端优先展示"复制磁链"功能，弱化"打开"按钮
- 检测设备类型（User-Agent），移动端隐藏或禁用"打开"按钮
- 提供二维码生成功能（可选，Phase 2）

### Trade-off 1：功能完整性 vs 实现速度

**选择：** 优先实现核心功能（展示、复制），暂缓高级功能（Aria2 集成）

**理由：**
- 80% 的价值来自 20% 的功能
- 快速交付，获取用户反馈
- 为后续迭代留出空间

### Trade-off 2：跨设备同步 vs 实现复杂度

**选择：** 不实现跨设备同步，使用 localStorage

**理由：**
- 个人项目，单设备使用场景为主
- 后端存储增加开发和维护成本
- 可在 Phase 3 根据需求添加

## Migration Plan

**部署步骤：**

1. **前端部署（apps/movie-app）**
   - 修改 `MovieDetail.vue`，新增播放源区块
   - 新增或修改 `Profile.vue`，添加下载列表 tab
   - 新增 `useDownloadList` composable，封装 localStorage 逻辑
   - 部署到 Cloudflare Pages

2. **后端验证（apps/api）**
   - 检查 `GET /api/movies/:code` 接口是否返回 players 数据
   - 如果缺失，修改查询逻辑，关联查询 players 表
   - 部署到 Cloudflare Workers

3. **数据验证**
   - 抽样检查 10 部影片的播放源数据完整性
   - 验证磁链格式是否符合标准

**回滚策略：**
- 前端：回滚到上一个版本即可，localStorage 数据不影响现有功能
- 后端：如果修改了 API，确保向后兼容（保持原有字段）

**灰度发布：**
- 可选：通过 feature flag 控制播放源区块显示
- 初期仅对部分用户开放，收集反馈后全量发布

## Open Questions

1. **API 数据格式确认**
   - 当前 `movieApi.getMovieDetail()` 是否已返回 players 数据？
   - 数据结构是否与预期一致？
   - 需要查看实际 API 响应进行确认

2. **磁链有效性**
   - 数据库中现有磁链的有效性如何？
   - 是否需要批量验证和清理？

3. **移动端交互**
   - 移动端用户如何使用磁链？
   - 是否需要提供二维码或其他辅助功能？

4. **下载列表容量**
   - 100 个影片是否合理？
   - 是否需要提供导出功能（导出为文本文件）？

这些问题将在实施过程中逐步解决，必要时更新设计文档。
