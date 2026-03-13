# 电影管理能力

## ADDED Requirements

### Requirement: Admin SHALL view paginated movie list

管理员 **SHALL** 能够查看电影列表，支持分页和基础信息展示。

#### Scenario: View first page
- **WHEN** admin navigates to `/dashboard/movies`
- **THEN** system displays first 20 movies with: code, title, cover, release date, crawl status

#### Scenario: Navigate to next page
- **WHEN** admin clicks "Next Page" button
- **THEN** system loads next 20 movies with loading indicator

#### Scenario: Empty state
- **WHEN** no movies exist in database
- **THEN** system displays "暂无电影数据" message with link to crawler monitoring

### Requirement: Admin SHALL filter movies by multiple criteria

管理员 **SHALL** 能够使用多个条件筛选电影，包括 R18 分类、爬取状态、演员、厂商、类型、日期范围。

#### Scenario: Filter by R18 status
- **WHEN** admin selects "R18: 是"
- **THEN** system displays only movies with `isR18 = true`

#### Scenario: Filter by crawl status
- **WHEN** admin selects "状态: pending"
- **THEN** system displays only movies with `crawlStatus = 'pending'`

#### Scenario: Filter by actor
- **WHEN** admin enters "波多野結衣" in actor search field
- **THEN** system displays movies where actors array contains matching name (case-insensitive)

#### Scenario: Filter by publisher
- **WHEN** admin selects "厂商: S1"
- **THEN** system displays movies with publisher matching "S1"

#### Scenario: Filter by genre
- **WHEN** admin checks "类型: 剧情, 中文字幕"
- **THEN** system displays movies with ANY of the selected genres

#### Scenario: Filter by release date range
- **WHEN** admin sets date range "2024-01-01" to "2024-12-31"
- **THEN** system displays movies released within that period

#### Scenario: Combine multiple filters
- **WHEN** admin applies: isR18=true, actor="波多野結衣", genre=["剧情"]
- **THEN** system displays movies matching ALL conditions (AND logic)

#### Scenario: Reset filters
- **WHEN** admin clicks "重置" button
- **THEN** all filter fields clear and full list displays

### Requirement: Admin SHALL sort movies by various fields

管理员 **SHALL** 能够对电影列表进行排序。

#### Scenario: Sort by release date descending
- **WHEN** admin selects "排序: 发布日期, 降序"
- **THEN** system displays movies with newest releases first

#### Scenario: Sort by manual sort order
- **WHEN** admin selects "排序: 人工排序"
- **THEN** system displays movies by `sortOrder` field (highest first)

#### Scenario: Sort by update time
- **WHEN** admin selects "排序: 更新时间"
- **THEN** system displays movies by `updatedAt` timestamp

### Requirement: Admin SHALL view and edit movie details

管理员 **SHALL** 能够查看电影的完整信息并编辑元数据。

#### Scenario: View movie detail
- **WHEN** admin clicks on a movie in the list
- **THEN** system displays: code, title, cover, description, actors, genres, publisher, release date, duration, R18 status, crawl status, metadata lock status, players count

#### Scenario: Edit basic metadata
- **WHEN** admin edits title, description, and clicks "保存"
- **THEN** system updates the movie in database and shows success message

#### Scenario: Toggle R18 status
- **WHEN** admin toggles "R18" checkbox and saves
- **THEN** system updates `isR18` field

#### Scenario: Lock metadata
- **WHEN** admin enables "锁定元数据" toggle and saves
- **THEN** system sets `metadataLocked = true` to prevent crawler overwrites

#### Scenario: Edit locked metadata
- **WHEN** admin edits a movie with `metadataLocked = true`
- **THEN** system displays warning "元数据已锁定，保存后将覆盖锁定状态" and allows editing

#### Scenario: Upload custom cover
- **WHEN** admin uploads new cover image
- **THEN** system uploads to R2, updates `cover` field, and displays new cover

#### Scenario: Edit with insufficient permission
- **WHEN** `movie_admin` attempts to edit a movie
- **THEN** system allows the edit

#### Scenario: Edit with no permission
- **WHEN** `comic_admin` attempts to access movie edit page
- **THEN** system redirects to `/unauthorized` with error message

### Requirement: Admin SHALL delete movies

管理员 **SHALL** 能够删除单个或批量删除电影。

#### Scenario: Delete single movie
- **WHEN** admin clicks "删除" button on movie detail page
- **THEN** system displays confirmation dialog "确认删除《电影标题》？"

#### Scenario: Confirm deletion
- **WHEN** admin confirms deletion
- **THEN** system deletes movie, all related players, and returns to movie list with success message

#### Scenario: Cancel deletion
- **WHEN** admin cancels deletion dialog
- **THEN** system closes dialog without deleting

### Requirement: Admin SHALL perform batch operations on movies

管理员 **SHALL** 能够对多个电影执行批量操作。

#### Scenario: Batch update R18 status
- **WHEN** admin selects 10 movies and chooses "批量设为 R18"
- **THEN** system displays confirmation with preview, updates all 10 movies, and shows result "成功: 10, 失败: 0"

#### Scenario: Batch lock metadata
- **WHEN** admin selects 5 movies and chooses "批量锁定元数据"
- **THEN** system sets `metadataLocked = true` for all 5 movies

#### Scenario: Batch update sort order
- **WHEN** admin selects 3 movies and inputs "排序权重: 100"
- **THEN** system updates `sortOrder` field for all 3 movies

#### Scenario: Batch delete
- **WHEN** admin selects 8 movies and chooses "批量删除"
- **THEN** system displays warning "⚠️ 此操作不可撤销", requires typing "CONFIRM", and deletes all 8 movies with their players

#### Scenario: Batch operation exceeds limit
- **WHEN** admin selects 150 movies for batch operation
- **THEN** system displays error "批量操作最多支持 100 项"

#### Scenario: Batch operation partial failure
- **WHEN** admin batch updates 10 movies, but 2 fail due to constraint violations
- **THEN** system shows result "成功: 8, 失败: 2" with error details for failed items

### Requirement: Movies table SHALL include management fields

`movies` 表 **SHALL** 包含以下管理字段以支持管理功能。

#### Scenario: New movie from crawler
- **WHEN** crawler creates a new movie
- **THEN** movie has: `metadataLocked = false`, `crawlStatus = 'complete'`, `sortOrder = 0`, `lastCrawledAt = current timestamp`

#### Scenario: Crawler respects metadata lock
- **WHEN** crawler encounters movie with `metadataLocked = true`
- **THEN** crawler skips metadata update but can still add new players

#### Scenario: Query by crawl status
- **WHEN** admin filters by `crawlStatus = 'partial'`
- **THEN** system returns movies with incomplete player data

### Requirement: Admin SHALL search movies by title or code

管理员 **SHALL** 能够通过标题或番号模糊搜索电影。

#### Scenario: Search by title
- **WHEN** admin enters "女教師" in search box
- **THEN** system displays movies with title containing "女教師" (case-insensitive)

#### Scenario: Search by code
- **WHEN** admin enters "SSIS-001"
- **THEN** system displays movie with code "SSIS-001"

#### Scenario: Search with no results
- **WHEN** admin searches for non-existent term
- **THEN** system displays "未找到匹配的电影"

### Requirement: Movie list SHALL indicate crawl status visually

电影列表 **SHALL** 用可视化标识显示爬取状态。

#### Scenario: Display pending status
- **WHEN** movie has `crawlStatus = 'pending'`
- **THEN** system displays orange badge "等待中"

#### Scenario: Display partial status
- **WHEN** movie has `crawlStatus = 'partial'`
- **THEN** system displays yellow badge "部分完成" with progress indicator `crawledPlayers/totalPlayers`

#### Scenario: Display complete status
- **WHEN** movie has `crawlStatus = 'complete'`
- **THEN** system displays green badge "已完成"
