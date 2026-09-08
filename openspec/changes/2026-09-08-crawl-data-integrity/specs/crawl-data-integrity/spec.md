## ADDED Requirements

### Requirement: 部署时声明 R2 图片地址
API 部署配置 MUST 输出由 target 派生的 R2_PUBLIC_URL；缺少该配置时媒体同步 MUST 拒绝写入，保留旧媒体。

#### Scenario: 生产部署
- **WHEN** 使用 starye-org target 生成 API 配置
- **THEN** R2_PUBLIC_URL 为 https://cdn.starye.org，后续发布继续保留该变量

### Requirement: R2 封面和图集
Movie 图集 MUST 以封面为首图并追加去重预览图。只有 R2 封面且无独立预览图的影片 MUST 被视为可展示，不反复占用缺封面回填名额。无封面、非 R2 封面或含未托管预览图 MUST 继续进入回填队列。

#### Scenario: 仅有 R2 封面
- **WHEN** 影片有 R2 封面但预览数组为空
- **THEN** 图集显示一张封面且不会作为缺图记录被重复回填

### Requirement: 回填失败保留已存媒体
影片同步 MUST 在新图片失败或仅返回外链时保留已有 R2 媒体；缺失或非 R2 的旧图不充当已修复证据。

#### Scenario: 外部图片下载失败
- **WHEN** 重爬返回空媒体且影片已有 R2 图片
- **THEN** 已有 R2 封面和图集保留

### Requirement: 重复抓取不累加旧进度
系统 MUST 使用当前章节身份集合与已存页面章节交集计算已爬章节数。

#### Scenario: 旧进度大于当前源集合
- **WHEN** 旧进度是 35，源包含 1 个唯一章节且该章节已保存
- **THEN** crawler 报告 1/1，且不重复抓取章节

### Requirement: 拒绝越界进度
API MUST 拒绝已爬章节数超过总数或 complete 与计数不符的请求，保留已有记录。

#### Scenario: 异常进度上报
- **WHEN** 请求上报 35/15
- **THEN** 返回 422 且不写入进度

### Requirement: 稳定的章节顺序
章节列表 MUST 在 sortOrder 相同时依次用 chapterNumber、id 排序。

#### Scenario: 源排序并列
- **WHEN** 两个章节的 sortOrder 相同
- **THEN** 重复查询返回一致顺序且保留两条记录
