# 漫画管理能力增强（Modified Capability）

## ADDED Requirements

### Requirement: Admin SHALL filter comics by multiple criteria

管理员 **SHALL** 能够使用多个条件筛选漫画（与电影管理保持一致）。

#### Scenario: Filter by author
- **WHEN** admin enters author name in filter
- **THEN** system displays comics by that author

#### Scenario: Filter by region
- **WHEN** admin selects "地区: 日本"
- **THEN** system displays comics with `region = '日本'`

#### Scenario: Filter by serialization status
- **WHEN** admin selects "状态: 连载中"
- **THEN** system displays comics with `status = '连载中'`

#### Scenario: Filter by crawl status
- **WHEN** admin selects "爬取状态: partial"
- **THEN** system displays comics with `crawlStatus = 'partial'`

#### Scenario: Combine multiple filters
- **WHEN** admin applies: isR18=true, author="XXX", status="连载中"
- **THEN** system displays comics matching ALL conditions

### Requirement: Admin SHALL sort comics by various fields

管理员 **SHALL** 能够对漫画列表进行排序。

#### Scenario: Sort by update time
- **WHEN** admin selects "排序: 更新时间, 降序"
- **THEN** system displays comics with most recently updated first

#### Scenario: Sort by manual order
- **WHEN** admin selects "排序: 人工排序"
- **THEN** system displays comics by `sortOrder` field (highest first)

### Requirement: Admin SHALL perform batch operations on comics

管理员 **SHALL** 能够对多个漫画执行批量操作。

#### Scenario: Batch update R18 status
- **WHEN** admin selects 10 comics and chooses "批量设为 R18"
- **THEN** system updates all 10 comics and displays result

#### Scenario: Batch lock metadata
- **WHEN** admin selects 5 comics and chooses "批量锁定元数据"
- **THEN** system sets `metadataLocked = true` for all 5 comics

#### Scenario: Batch delete
- **WHEN** admin selects 8 comics and chooses "批量删除"
- **THEN** system displays confirmation, requires typing "CONFIRM", and deletes all 8 comics with their chapters

### Requirement: Admin SHALL batch manage chapters

管理员 **SHALL** 能够批量删除章节。

#### Scenario: Batch delete chapters
- **WHEN** admin selects multiple chapters and clicks "批量删除"
- **THEN** system displays confirmation and deletes all selected chapters

#### Scenario: Re-crawl failed chapters
- **WHEN** admin selects chapters with incomplete images and clicks "重新爬取"
- **THEN** system marks chapters as `crawlStatus = 'pending'` and triggers crawler

### Requirement: Comic list SHALL indicate crawl status visually

漫画列表 **SHALL** 用可视化标识显示爬取状态（与电影保持一致）。

#### Scenario: Display pending badge
- **WHEN** comic has `crawlStatus = 'pending'`
- **THEN** system displays orange badge "等待中"

#### Scenario: Display partial badge with progress
- **WHEN** comic has `crawlStatus = 'partial'` and `crawledChapters = 10, totalChapters = 20`
- **THEN** system displays yellow badge "部分完成 (10/20)"

#### Scenario: Display complete badge
- **WHEN** comic has `crawlStatus = 'complete'`
- **THEN** system displays green badge "已完成"
