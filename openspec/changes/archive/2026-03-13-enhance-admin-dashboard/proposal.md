# 完善管理后台 - 内容管理与权限分离

## Why

当前管理后台（Dashboard）只有基础的漫画管理功能，缺少完整的电影管理界面。随着两个爬虫的稳定运行，大量漫画和电影数据正在流入，急需完善的管理工具来：
1. 审核和编辑内容元数据（标题、标签、描述等）
2. 管理播放源、演员、厂商等关联数据
3. 监控爬虫运行状态和失败任务
4. 实现细粒度的角色权限控制（comic_admin vs movie_admin）

此外，考虑到法规风险，**MUST** 确保漫画和电影内容完全独立管理，不同管理员角色只能访问其权限范围内的内容。

## What Changes

### 后端增强
- 为 `movies` 表添加管理字段（`metadataLocked`、`crawlStatus`、`sortOrder` 等）
- 扩展 Admin API 路由，添加电影管理接口（CRUD、筛选、排序、批量操作）
- 添加爬虫管理 API（查看运行状态、失败任务、手动触发恢复）
- 添加操作审计日志系统（记录管理员的所有操作）
- 完善角色权限中间件，支持 `comic_admin`、`movie_admin` 的细粒度控制

### 前端增强
- Dashboard 添加电影管理页面（类似现有的漫画管理）
- 实现高级筛选和排序 UI（多条件组合、保存筛选器）
- 添加批量操作功能（批量修改 R18 标记、批量锁定元数据、批量删除）
- 新建爬虫管理页面（显示统计、失败任务列表、恢复按钮）
- 新建播放源管理页面（查看、编辑、删除播放源）
- 新建演员/厂商管理页面（列表、详情、编辑）
- 添加操作日志查看页面（时间线展示，按操作者和类型过滤）

### 权限隔离
- **BREAKING**: 角色权限严格分离
  - `admin` / `super_admin`: 全局访问
  - `comic_admin`: 只能访问漫画相关数据和操作
  - `movie_admin`: 只能访问电影相关数据和操作
- 所有 API 路由强制鉴权检查
- Dashboard UI 根据角色动态显示菜单

## Capabilities

### New Capabilities

- `admin-movie-management`: 电影内容管理能力
  - 电影 CRUD（查看、编辑、删除）
  - 高级筛选（按演员、厂商、类型、日期范围）
  - 排序（发布日期、更新时间、手动排序）
  - 批量操作（批量修改元数据、批量删除）
  - 元数据锁定（防止爬虫覆盖）

- `admin-crawler-monitoring`: 爬虫监控与管理能力
  - 查看爬虫统计（成功率、失败数、处理数量）
  - 查看失败任务列表（按错误类型分组）
  - 手动触发失败任务恢复
  - 查看爬取进度（pending/partial/complete）

- `admin-player-management`: 播放源管理能力
  - 查看电影的所有播放源
  - 添加/编辑/删除播放源
  - 批量导入播放源
  - 播放源测试（验证链接有效性）

- `admin-actor-publisher-management`: 演员和厂商管理能力
  - 演员列表（按作品数量排序）
  - 演员详情编辑（头像、简介、社交链接等）
  - 厂商列表和详情编辑
  - 合并重复数据（处理爬虫导致的重复）

- `admin-audit-logging`: 操作审计日志能力
  - 记录所有管理操作（创建、更新、删除）
  - 日志包含：操作者、操作类型、目标资源、时间戳、变更详情
  - 日志查询和过滤
  - 时间线视图展示

- `admin-rbac-granular`: 细粒度角色权限控制能力
  - 支持 `comic_admin` 和 `movie_admin` 角色
  - 权限矩阵（角色 × 资源 × 操作）
  - API 路由级别的权限检查
  - UI 菜单根据角色动态渲染

### Modified Capabilities

- `admin-comic-management`: 现有漫画管理能力增强
  - 添加高级筛选（按作者、地区、类型、连载状态、爬取状态）
  - 添加批量操作
  - 改进章节管理（批量删除章节、重新爬取失败章节）

## Impact

**数据库 Schema 变更**:
- `movies` 表添加字段：`metadataLocked`, `crawlStatus`, `lastCrawledAt`, `sortOrder`
- 新建 `audit_logs` 表：记录所有管理操作
- 可能需要添加索引以优化筛选性能

**代码影响**:
- `packages/db/src/schema.ts` - 数据库 schema 扩展
- `apps/api/src/routes/admin.ts` - 大幅扩展管理 API
- `apps/dashboard/src/views/` - 新增多个管理页面
- `apps/dashboard/src/router/index.ts` - 添加路由和权限守卫
- `apps/api/src/middleware/service-auth.ts` - 增强权限检查逻辑

**API 变更** (兼容性):
- 新增 Admin API 端点（向后兼容）
- 权限检查更严格（可能影响现有管理操作）

**前端组件需求**:
- 表格组件（支持筛选、排序、分页）
- 筛选器组件（多条件组合）
- 批量操作面板
- 日志时间线组件

**部署影响**:
- 需要运行数据库迁移
- 需要更新环境变量（审计日志配置）
- Dashboard 需要重新部署

**风险**:
- 权限分离可能导致现有管理员失去访问权限（需要迁移脚本）
- 批量操作可能误删大量数据（需要确认机制）
- 审计日志可能占用大量存储空间（需要定期清理策略）

**预期结果**:
- Admin **SHALL** 能够完整管理电影库（与漫画同等能力）
- `comic_admin` **SHALL** 只能访问漫画相关功能
- `movie_admin` **SHALL** 只能访问电影相关功能
- 所有管理操作 **MUST** 被审计日志记录
