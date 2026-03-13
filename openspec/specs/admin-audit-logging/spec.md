# admin-audit-logging Specification

## Purpose
TBD - created by archiving change enhance-admin-dashboard. Update Purpose after archive.
## Requirements
### Requirement: System SHALL log all admin operations

系统 **SHALL** 记录所有管理员的 CUD 操作（Create, Update, Delete）到审计日志。

#### Scenario: Log create operation
- **WHEN** admin creates a new movie manually
- **THEN** system creates audit log entry with: userId, userEmail, action="CREATE", resourceType="movie", resourceId, createdAt

#### Scenario: Log update operation
- **WHEN** admin updates movie metadata
- **THEN** system creates audit log with action="UPDATE" and `changes` field containing: `{ before: { title: "旧标题" }, after: { title: "新标题" } }`

#### Scenario: Log delete operation
- **WHEN** admin deletes a chapter
- **THEN** system creates audit log with action="DELETE" and stores deleted resource identifier in `resourceIdentifier`

#### Scenario: Log batch operation
- **WHEN** admin batch updates 10 movies
- **THEN** system creates ONE audit log with action="BULK_UPDATE", `affectedCount=10`, and `resourceId=null`

#### Scenario: Do not log read operations
- **WHEN** admin views movie list or detail
- **THEN** system does NOT create audit log (read operations not logged)

### Requirement: Audit logs SHALL include user context

审计日志 **SHALL** 包含操作者的上下文信息。

#### Scenario: Log includes user identification
- **WHEN** any operation is logged
- **THEN** log entry includes: `userId`, `userEmail`, `ipAddress`, `userAgent`

#### Scenario: Log includes timestamp
- **WHEN** any operation is logged
- **THEN** log entry includes ISO 8601 timestamp in `createdAt` field

### Requirement: Admin SHALL view audit logs

管理员（仅 `admin` 角色）**SHALL** 能够查看审计日志。

#### Scenario: View recent logs
- **WHEN** admin navigates to `/dashboard/audit-logs`
- **THEN** system displays most recent 50 logs in reverse chronological order

#### Scenario: Filter by user
- **WHEN** admin selects "操作者: user@example.com"
- **THEN** system displays logs for that user only

#### Scenario: Filter by resource type
- **WHEN** admin selects "资源类型: movie"
- **THEN** system displays logs for movie operations only

#### Scenario: Filter by action type
- **WHEN** admin selects "操作: DELETE"
- **THEN** system displays all delete operations

#### Scenario: Filter by date range
- **WHEN** admin sets date range "2024-03-01" to "2024-03-13"
- **THEN** system displays logs within that period

#### Scenario: Non-admin cannot view logs
- **WHEN** `comic_admin` or `movie_admin` attempts to access audit logs
- **THEN** system returns 403 Forbidden

### Requirement: Admin SHALL view operation change details

管理员 **SHALL** 能够查看操作的变更详情。

#### Scenario: View changes for update operation
- **WHEN** admin expands an UPDATE log entry
- **THEN** system displays diff view: "title: 旧标题 → 新标题", "isR18: false → true"

#### Scenario: View changes for bulk operation
- **WHEN** admin expands a BULK_UPDATE log entry
- **THEN** system displays: affected count, operation type, and summary of changes

### Requirement: Audit logs SHALL be retained for 90 days

审计日志 **SHALL** 保留 90 天，超过的日志自动归档。

#### Scenario: Old logs are archived
- **WHEN** system runs daily cleanup task
- **THEN** logs older than 90 days are moved to R2 archive bucket

#### Scenario: Admin exports logs before archival
- **WHEN** admin clicks "导出日志" with date range
- **THEN** system downloads CSV or JSON file with selected logs

### Requirement: Audit log API SHALL have rate limits

审计日志查询 **SHALL** 有合理的速率限制以防止滥用。

#### Scenario: Query within rate limit
- **WHEN** admin queries logs < 10 times per minute
- **THEN** system returns results normally

#### Scenario: Query exceeds rate limit
- **WHEN** admin queries logs > 10 times per minute
- **THEN** system returns 429 Too Many Requests

### Requirement: Audit logs SHALL NOT log sensitive data

审计日志 **SHALL NOT** 记录敏感信息（密码、tokens 等）。

#### Scenario: Update operation with sensitive field
- **WHEN** system logs an update to user authentication data
- **THEN** `changes` field masks sensitive values: `{ password: "[REDACTED]" }`

#### Scenario: Log includes only allowed fields
- **WHEN** system creates audit log
- **THEN** `changes` field includes only non-sensitive metadata fields

