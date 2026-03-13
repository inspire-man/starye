# 演员和厂商管理能力

## ADDED Requirements

### Requirement: Admin SHALL view actor list with statistics

管理员 **SHALL** 能够查看演员列表及其统计信息。

#### Scenario: View actor list sorted by movie count
- **WHEN** admin navigates to `/dashboard/actors`
- **THEN** system displays actors sorted by movie count (descending) with: name, avatar, movie count

#### Scenario: Search actors by name
- **WHEN** admin enters "波多野" in search box
- **THEN** system displays actors with name containing "波多野" (case-insensitive)

#### Scenario: Paginate actor list
- **WHEN** actor list has more than 50 items
- **THEN** system displays first 50 and provides pagination controls

### Requirement: Admin SHALL view and edit actor details

管理员 **SHALL** 能够查看和编辑演员的详细信息。

#### Scenario: View actor detail page
- **WHEN** admin clicks on an actor
- **THEN** system displays: name, avatar, bio, social links, list of movies featuring this actor

#### Scenario: Edit actor bio
- **WHEN** admin edits actor bio and saves
- **THEN** system updates actor record

#### Scenario: Upload actor avatar
- **WHEN** admin uploads avatar image
- **THEN** system uploads to R2, updates `avatar` field, and displays new avatar

#### Scenario: View actor's movies
- **WHEN** admin views actor detail page
- **THEN** system displays list of movies featuring this actor with links to movie detail pages

### Requirement: Admin SHALL merge duplicate actors

管理员 **SHALL** 能够合并重复的演员记录（处理爬虫导致的变体）。

#### Scenario: Select actors to merge
- **WHEN** admin selects "波多野結衣" and "波多野结衣" (duplicate)
- **THEN** system displays merge dialog: "将 A 合并到 B？"

#### Scenario: Confirm merge
- **WHEN** admin confirms merge
- **THEN** system: updates all movies to reference target actor, updates target's movie count, deletes source actor, shows "已合并，影响 15 部电影"

#### Scenario: Merge with name conflict
- **WHEN** admin merges actors with conflicting metadata (bio, avatar)
- **THEN** system displays conflict resolution UI: "保留哪个头像？ (A) / (B)"

### Requirement: Admin SHALL view publisher list

管理员 **SHALL** 能够查看厂商列表及其统计信息。

#### Scenario: View publisher list
- **WHEN** admin navigates to `/dashboard/publishers`
- **THEN** system displays publishers with: name, logo, movie count, sorted by movie count

#### Scenario: Search publishers
- **WHEN** admin enters "S1" in search box
- **THEN** system displays publishers with name containing "S1"

### Requirement: Admin SHALL edit publisher details

管理员 **SHALL** 能够编辑厂商信息。

#### Scenario: Edit publisher name
- **WHEN** admin edits publisher name and saves
- **THEN** system updates publisher record

#### Scenario: Upload publisher logo
- **WHEN** admin uploads logo image
- **THEN** system uploads to R2, updates `logo` field

#### Scenario: View publisher's movies
- **WHEN** admin views publisher detail page
- **THEN** system displays list of movies from this publisher

### Requirement: Admin SHALL merge duplicate publishers

管理员 **SHALL** 能够合并重复的厂商记录。

#### Scenario: Merge publishers
- **WHEN** admin merges "S1 NO.1 STYLE" and "S1"
- **THEN** system: updates all movies to reference target publisher, updates target's movie count, deletes source publisher

### Requirement: Actor and Publisher operations SHALL respect permissions

演员和厂商操作 **SHALL** 遵守角色权限。

#### Scenario: Movie admin can manage actors
- **WHEN** `movie_admin` edits actor or publisher
- **THEN** system allows the operation

#### Scenario: Comic admin cannot manage actors
- **WHEN** `comic_admin` attempts to access `/dashboard/actors`
- **THEN** system redirects to `/unauthorized`

#### Scenario: Admin can manage all
- **WHEN** `admin` accesses actor or publisher pages
- **THEN** system allows all operations
