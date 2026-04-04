# admin-crawler-monitoring Delta Specification

## MODIFIED Requirements

### Requirement: Admin SHALL trigger failed task recovery

管理员 **SHALL** 能够手动触发失败任务的恢复爬取，危险操作 **SHALL** 通过 ConfirmDialog 进行二次确认。

#### Scenario: Clear failed tasks with confirmation
- **WHEN** 管理员点击"清空失败任务记录"按钮
- **THEN** 系统显示 ConfirmDialog（而非原生 `confirm()` 弹窗），标题为"确认清空失败任务"，消息为"此操作将清空所有失败记录，确认继续？"

#### Scenario: User cancels clear operation
- **WHEN** 管理员在 ConfirmDialog 中点击"取消"
- **THEN** ConfirmDialog 关闭，失败任务记录保持不变

#### Scenario: User confirms clear operation
- **WHEN** 管理员在 ConfirmDialog 中点击"确认"
- **THEN** 系统调用 `api.admin.clearFailedTasks(type)`，成功后刷新失败任务列表并显示 success Toast

#### Scenario: View recovery instructions
- **WHEN** admin clicks "触发恢复任务" button
- **THEN** system displays instructions to manually trigger GitHub Actions workflow with `RECOVERY_MODE=true`

#### Scenario: Export failed tasks
- **WHEN** admin clicks "导出失败任务"
- **THEN** system downloads `.json` file with all failed tasks

#### Scenario: Stats auto-refresh
- **WHEN** admin stays on crawler monitoring page for 30 seconds
- **THEN** system automatically fetches updated stats
