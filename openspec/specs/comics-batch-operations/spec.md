# comics-batch-operations Specification

## Purpose
为漫画管理页面提供批量操作能力，包括批量设置 R18、批量锁定/解锁元数据、批量删除漫画，以及章节的批量删除。复用 Movies.vue 已验证的批量操作模式。

## ADDED Requirements

### Requirement: Admin SHALL select multiple comics for batch operations

管理员 **SHALL** 能够在漫画列表中选择多部漫画以执行批量操作。

#### Scenario: Select individual comic
- **WHEN** 管理员点击漫画卡片上的复选框
- **THEN** 该漫画进入选中状态，卡片显示选中样式，页面顶部显示"已选择 N 部漫画"的操作栏

#### Scenario: Select all on current page
- **WHEN** 管理员点击"全选当前页"按钮
- **THEN** 当前页面所有漫画均被选中，操作栏更新计数

#### Scenario: Deselect all
- **WHEN** 管理员点击"取消选择"按钮
- **THEN** 所有漫画取消选中，批量操作栏隐藏

#### Scenario: Selection persists during page navigation
- **WHEN** 管理员在选中漫画后翻到下一页
- **THEN** 选中状态清空（仅支持当前页批量操作）

### Requirement: Admin SHALL batch update comic R18 status

管理员 **SHALL** 能够对选中的多部漫画批量设置或取消 R18 标记。

#### Scenario: Batch set R18
- **WHEN** 管理员选中若干漫画并点击"批量操作 → 设为 R18"
- **THEN** 系统显示 ConfirmDialog，确认后调用 `bulkOperationComics(ids, 'update_r18')`，成功后刷新列表并显示 success Toast

#### Scenario: Batch operation success feedback
- **WHEN** 批量操作成功完成
- **THEN** 系统显示 `"成功对 N 部漫画执行了操作"` 的 success Toast，批量选中状态清空

### Requirement: Admin SHALL batch lock and unlock comic metadata

管理员 **SHALL** 能够批量锁定或解锁漫画元数据，防止爬虫覆盖手动编辑内容。

#### Scenario: Batch lock metadata
- **WHEN** 管理员选中漫画并点击"批量操作 → 锁定元数据"
- **THEN** 系统确认后将选中漫画的 `metadataLocked = true`，刷新列表

#### Scenario: Batch unlock metadata
- **WHEN** 管理员选中漫画并点击"批量操作 → 解锁元数据"
- **THEN** 系统确认后将选中漫画的 `metadataLocked = false`，刷新列表

### Requirement: Admin SHALL batch delete comics with confirmation

管理员 **SHALL** 能够批量删除漫画，操作需经过明确确认以防误删。

#### Scenario: Batch delete with progress
- **WHEN** 管理员选中若干漫画并点击"批量操作 → 批量删除"
- **THEN** 系统显示 ConfirmDialog，确认后以 Progress Toast 逐条删除，完成后显示"成功删除 N 部漫画"

#### Scenario: Batch delete partial failure
- **WHEN** 批量删除中部分漫画删除失败
- **THEN** 系统显示 warning Toast：`"完成删除: 成功 X 部，失败 Y 部"`

#### Scenario: Batch delete exceeds limit
- **WHEN** 管理员选中超过 100 部漫画进行批量删除
- **THEN** 系统显示 error Toast：`"批量操作最多支持 100 项"`，不执行删除

### Requirement: Admin SHALL batch delete chapters within a comic

管理员 **SHALL** 能够在漫画编辑 Modal 的章节标签页中批量删除章节。

#### Scenario: Select chapters for batch delete
- **WHEN** 管理员在章节列表中勾选多个章节
- **THEN** 页面底部显示"批量删除 N 个章节"按钮

#### Scenario: Confirm chapter batch delete
- **WHEN** 管理员点击章节批量删除按钮
- **THEN** ConfirmDialog 显示"确认删除选中的 N 个章节？此操作不可撤销"，确认后调用 `bulkDeleteChapters(comicId, chapterIds)`

#### Scenario: Chapter batch delete success
- **WHEN** 章节批量删除成功
- **THEN** 章节列表刷新，显示 success Toast `"已删除 N 个章节"`
