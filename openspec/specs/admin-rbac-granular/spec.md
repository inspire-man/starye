# admin-rbac-granular Specification

## Purpose
TBD - created by archiving change enhance-admin-dashboard. Update Purpose after archive.
## Requirements
### Requirement: System SHALL enforce role-based resource isolation

系统 **SHALL** 基于用户角色严格隔离漫画和电影资源的访问权限。

#### Scenario: Admin accesses all resources
- **WHEN** user with `role = 'admin'` requests any API endpoint
- **THEN** system grants access

#### Scenario: Comic admin accesses comic resources
- **WHEN** user with `role = 'comic_admin'` requests `/api/admin/comics/*`
- **THEN** system grants access

#### Scenario: Comic admin cannot access movie resources
- **WHEN** user with `role = 'comic_admin'` requests `/api/admin/movies/*`
- **THEN** system returns 403 Forbidden with message "Insufficient permissions"

#### Scenario: Movie admin accesses movie resources
- **WHEN** user with `role = 'movie_admin'` requests `/api/admin/movies/*`
- **THEN** system grants access

#### Scenario: Movie admin cannot access comic resources
- **WHEN** user with `role = 'movie_admin'` requests `/api/admin/comics/*`
- **THEN** system returns 403 Forbidden

#### Scenario: Regular user cannot access admin endpoints
- **WHEN** user with `role = 'user'` requests any `/api/admin/*` endpoint
- **THEN** system returns 403 Forbidden

### Requirement: Dashboard SHALL display menu items based on role

Dashboard **SHALL** 根据用户角色动态显示导航菜单项。

#### Scenario: Admin sees all menu items
- **WHEN** user with `role = 'admin'` loads dashboard
- **THEN** sidebar displays: 漫画管理, 电影管理, 爬虫监控, 用户管理, 审计日志, 设置

#### Scenario: Comic admin sees limited menu
- **WHEN** user with `role = 'comic_admin'` loads dashboard
- **THEN** sidebar displays ONLY: 漫画管理, 爬虫监控(漫画), 设置

#### Scenario: Movie admin sees limited menu
- **WHEN** user with `role = 'movie_admin'` loads dashboard
- **THEN** sidebar displays ONLY: 电影管理, 演员管理, 厂商管理, 爬虫监控(电影), 设置

### Requirement: Admin SHALL assign roles to users

超级管理员 **SHALL** 能够为用户分配角色。

#### Scenario: Change user to comic admin
- **WHEN** admin changes user role to `comic_admin`
- **THEN** system updates user record and revokes access to movie resources

#### Scenario: Change user to movie admin
- **WHEN** admin changes user role to `movie_admin`
- **THEN** system updates user record and revokes access to comic resources

#### Scenario: Promote user to admin
- **WHEN** admin changes user role to `admin`
- **THEN** system grants user access to all resources

#### Scenario: Non-admin cannot assign roles
- **WHEN** `comic_admin` or `movie_admin` attempts to access user management
- **THEN** system returns 403 Forbidden

### Requirement: API middleware SHALL validate resource-level permissions

API 中间件 **SHALL** 在路由级别验证资源权限。

#### Scenario: Comic route requires comic permission
- **WHEN** any request hits `/api/admin/comics/*`
- **THEN** middleware checks user role is one of: `admin`, `comic_admin`

#### Scenario: Movie route requires movie permission
- **WHEN** any request hits `/api/admin/movies/*`
- **THEN** middleware checks user role is one of: `admin`, `movie_admin`

#### Scenario: Global route requires admin only
- **WHEN** any request hits `/api/admin/users/*` or `/api/admin/audit-logs/*`
- **THEN** middleware checks user role is `admin` or `super_admin`

#### Scenario: Permission check fails
- **WHEN** user lacks required permission
- **THEN** middleware returns 403 with JSON: `{ error: "Insufficient permissions", required: ["admin"], actual: "comic_admin" }`

### Requirement: Frontend router SHALL prevent unauthorized navigation

前端路由守卫 **SHALL** 阻止未授权用户访问受限页面。

#### Scenario: Comic admin attempts to access movies page
- **WHEN** `comic_admin` navigates to `/dashboard/movies`
- **THEN** router redirects to `/unauthorized` and displays "您没有权限访问此页面"

#### Scenario: Direct URL access without permission
- **WHEN** `movie_admin` opens `/dashboard/comics` via direct URL
- **THEN** router blocks navigation and redirects to `/unauthorized`

#### Scenario: Authorized navigation
- **WHEN** user navigates to page they have permission for
- **THEN** router allows navigation

### Requirement: Role permissions SHALL be clearly documented

权限矩阵 **SHALL** 在代码和文档中明确定义。

#### Scenario: Permission matrix exists
- **WHEN** developer checks documentation
- **THEN** documentation includes complete permission matrix showing which roles can access which resources

#### Scenario: Permission check is centralized
- **WHEN** developer adds new admin endpoint
- **THEN** developer uses `requireResource()` middleware with appropriate resource type

### Requirement: System SHALL prevent privilege escalation

系统 **SHALL** 防止权限提升攻击。

#### Scenario: Comic admin cannot promote themselves
- **WHEN** `comic_admin` attempts to change their own role to `admin`
- **THEN** system returns 403 Forbidden

#### Scenario: Admin cannot access super_admin functions
- **WHEN** `admin` attempts super_admin-only operations
- **THEN** system returns 403 Forbidden

