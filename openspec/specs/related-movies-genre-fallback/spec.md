# Spec：相关影片 Genre 自动补全（Fallback）

## 目标

当影片详情接口查询到的相关影片（演员+系列合并去重）数量不足时，自动以同 genre 热门影片补全，提升相关影片推荐的覆盖率。

---

## Requirements

### Requirement: 相关影片不足时 genre 自动补全
当影片详情接口查询到的相关影片（演员+系列合并去重后）数量少于 4 条时，系统 MUST 追加同 genre 的热门影片，使最终返回的 `relatedMovies` 总数尽量达到 6 条。

- MUST 优先使用当前影片 `genres` 数组的第一个非空值作为 fallback genre
- MUST 按 `viewCount DESC` 排序取补充影片
- MUST 排除已在演员/系列结果中出现的影片 id（不重复）
- MUST 排除当前影片自身
- 若影片 `genres` 为空或 fallback 查询无结果，MUST 静默返回当前已有结果（不报错）
- R18 过滤规则 MUST 与演员/系列查询保持一致（未认证用户只看非 R18 影片）

#### Scenario: 演员推荐结果不足 4 条时触发 fallback
- **WHEN** 影片无关联演员，且系列结果为 0，genres 非空
- **THEN** 系统 MUST 查询同 genre 热门影片补充至最多 6 条

#### Scenario: 演员+系列已满 4 条以上时不触发 fallback
- **WHEN** 演员+系列合并结果 ≥ 4 条
- **THEN** 系统 MUST 不执行 genre fallback 查询，直接截取前 6 返回

#### Scenario: genres 为空时跳过 fallback
- **WHEN** 影片 genres 字段为 null 或空数组，且演员+系列结果 < 4 条
- **THEN** 系统 MUST 返回现有结果，不报错、不执行额外查询

#### Scenario: fallback 结果去重
- **WHEN** genre fallback 查询到的影片中有 id 已在演员/系列结果中
- **THEN** 重复影片 MUST 被跳过，不重复出现在最终 relatedMovies 中
