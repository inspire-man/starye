# admin-crawler-monitoring Specification

## Purpose
TBD - created by archiving change enhance-admin-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Admin SHALL view crawler statistics

管理员 **SHALL** 能够查看漫画和电影爬虫的统计信息。

#### Scenario: View comic crawler stats
- **WHEN** `admin` or `comic_admin` navigates to crawler monitoring page
- **THEN** system displays comic stats: total count, pending count, partial count, complete count, last crawl timestamp

#### Scenario: View movie crawler stats
- **WHEN** `admin` or `movie_admin` navigates to crawler monitoring page
- **THEN** system displays movie stats: total count, pending count, partial count, complete count, last crawl timestamp

#### Scenario: Comic admin cannot view movie stats
- **WHEN** `comic_admin` requests movie crawler stats
- **THEN** system returns 403 or displays only comic stats

#### Scenario: Stats auto-refresh
- **WHEN** admin stays on crawler monitoring page for 30 seconds
- **THEN** system automatically fetches updated stats

### Requirement: Admin SHALL view failed task list

管理员 **SHALL** 能够查看爬虫失败任务的详细列表。

#### Scenario: View all failed tasks
- **WHEN** admin opens "失败任务" tab
- **THEN** system displays list of failed tasks from `.crawler-failed-tasks.json` and `.javbus-failed-tasks.json` (filtered by role permission)

#### Scenario: Group by error type
- **WHEN** admin views failed tasks
- **THEN** system groups tasks by error type: ERR_ABORTED, TIMEOUT, PARSE_ERROR, HTTP_ERROR

#### Scenario: View task details
- **WHEN** admin clicks on a failed task
- **THEN** system displays: URL, error message, retry count, timestamp

#### Scenario: Filter by resource type
- **WHEN** `comic_admin` views failed tasks
- **THEN** system displays ONLY failed comic tasks

### Requirement: Admin SHALL trigger failed task recovery

管理员 **SHALL** 能够手动触发失败任务的恢复爬取，危险操作 **SHALL** 通过 ConfirmDialog 进行二次确认。

#### Scenario: View recovery instructions
- **WHEN** admin clicks "触发恢复任务" button
- **THEN** system displays instructions to manually trigger GitHub Actions workflow with `RECOVERY_MODE=true`

#### Scenario: Export failed tasks
- **WHEN** admin clicks "导出失败任务"
- **THEN** system downloads `.json` file with all failed tasks

#### Scenario: Clear failed tasks with confirmation
- **WHEN** 管理员点击"清空失败任务记录"按钮
- **THEN** 系统显示 ConfirmDialog（而非原生 `confirm()` 弹窗），标题为"确认清空失败任务"，消息为"此操作将清空所有失败记录，确认继续？"

#### Scenario: User cancels clear operation
- **WHEN** 管理员在 ConfirmDialog 中点击"取消"
- **THEN** ConfirmDialog 关闭，失败任务记录保持不变

#### Scenario: User confirms clear operation
- **WHEN** 管理员在 ConfirmDialog 中点击"确认"
- **THEN** 系统调用 `api.admin.clearFailedTasks(type)`，成功后刷新失败任务列表并显示 success Toast

### Requirement: Admin SHALL view crawl progress

管理员 **SHALL** 能够查看爬取进度（pending/partial/complete）。

#### Scenario: View pending items
- **WHEN** admin clicks "Pending (23)" badge
- **THEN** system navigates to filtered list showing items with `crawlStatus = 'pending'`

#### Scenario: View partial items
- **WHEN** admin clicks "Partial (5)" badge
- **THEN** system navigates to filtered list showing items with `crawlStatus = 'partial'` and displays progress indicator (e.g., "12/20 章节")

#### Scenario: View complete items
- **WHEN** admin clicks "Complete (1,200)" badge
- **THEN** system navigates to filtered list showing items with `crawlStatus = 'complete'`

### Requirement: Crawler stats SHALL be computed efficiently

爬虫统计数据 **SHALL** 通过高效的数据库查询计算。

#### Scenario: Stats computed via COUNT queries
- **WHEN** system computes crawler stats
- **THEN** system uses indexed COUNT queries, NOT full table scans

#### Scenario: Stats cached for performance
- **WHEN** multiple admins view crawler stats within 60 seconds
- **THEN** system MAY return cached results (optional optimization)

