# admin-player-management Specification

## Purpose
TBD - created by archiving change enhance-admin-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Admin SHALL view all players for a movie

管理员 **SHALL** 能够查看某部电影的所有播放源。

#### Scenario: View player list
- **WHEN** admin opens movie detail page
- **THEN** system displays list of players with: source name, player name, URL, status

#### Scenario: Empty player list
- **WHEN** movie has no players
- **THEN** system displays "暂无播放源" and link to trigger crawler

### Requirement: Admin SHALL manually add player

管理员 **SHALL** 能够手动添加播放源到电影。

#### Scenario: Add new player
- **WHEN** admin clicks "添加播放源" button
- **THEN** system displays form: source name, player name, URL

#### Scenario: Submit player form
- **WHEN** admin fills form and submits
- **THEN** system creates player record, increments `totalPlayers`, and displays success message

#### Scenario: Add duplicate player
- **WHEN** admin adds player with same URL as existing player
- **THEN** system displays warning "该播放源已存在"

### Requirement: Admin SHALL edit player details

管理员 **SHALL** 能够编辑播放源的信息。

#### Scenario: Edit player URL
- **WHEN** admin edits player URL and saves
- **THEN** system updates player record

#### Scenario: Edit player name
- **WHEN** admin edits player name and saves
- **THEN** system updates player record

#### Scenario: Inline edit - only one row active
- **WHEN** admin clicks 「编辑」on a second row while another row is already in edit mode
- **THEN** the first row exits edit mode (discarding unsaved changes) and the new row enters edit mode

#### Scenario: Cancel inline edit
- **WHEN** admin clicks 「取消」in edit mode
- **THEN** the row reverts to its original values with no API call made

### Requirement: Admin SHALL delete player

管理员 **SHALL** 能够删除播放源。

#### Scenario: Delete single player
- **WHEN** admin clicks "删除" button on player
- **THEN** system displays confirmation "确认删除此播放源？"

#### Scenario: Confirm player deletion
- **WHEN** admin confirms
- **THEN** system deletes player, decrements `totalPlayers`, and shows success message

#### Scenario: Delete button disabled during deletion
- **WHEN** delete request is in progress
- **THEN** confirm button is disabled to prevent duplicate requests

#### Scenario: Delete last player
- **WHEN** admin deletes the last player of a movie
- **THEN** system updates movie `totalPlayers = 0` and MAY update `crawlStatus` to 'partial'

### Requirement: Admin SHALL test player URL

管理员 **SHALL** 能够测试播放源链接的有效性。

#### Scenario: Test player URL
- **WHEN** admin clicks "测试" button on player
- **THEN** system opens player URL in new browser tab

#### Scenario: Batch test all players
- **WHEN** admin clicks "测试所有播放源" button
- **THEN** system displays report: "可访问: 15, 无法访问: 2"

### Requirement: Admin SHALL batch import players

管理员 **SHALL** 能够批量导入播放源（通过 JSON 或 CSV）。

#### Scenario: Import players from JSON
- **WHEN** admin uploads JSON file with format: `[{ source, playerName, url }, ...]`
- **THEN** system validates format, imports all valid players, and shows result "成功: 20, 失败: 3"

#### Scenario: Import with invalid format
- **WHEN** admin uploads invalid JSON
- **THEN** system displays error "格式错误，请检查 JSON 结构"

#### Scenario: Import with duplicate URLs
- **WHEN** admin imports players with duplicate URLs
- **THEN** system skips duplicates and reports "已跳过 5 个重复播放源"

