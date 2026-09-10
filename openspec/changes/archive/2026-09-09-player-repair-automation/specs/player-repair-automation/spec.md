## ADDED Requirements

### Requirement: 定时补全与失败退避
系统 SHALL 在页面关闭时扫描缺少或持续失效的来源，并遵守任务租约与幂等性；连续失败 SHALL 根据持久化运行历史计算并使用有上限的退避。

#### Scenario: 影片缺少来源
- **WHEN** 影片没有 player 记录且没有活动任务
- **THEN** 扫描创建可调度的 repair 任务并返回其持久化身份

#### Scenario: 连续失败
- **WHEN** 最近补全连续失败且还处于退避窗口
- **THEN** 扫描跳过该影片并显示失败次数和下一次重试时间

### Requirement: 身份绑定的来源发现
系统 SHALL 通过影片编号发现候选，验证详情身份并保留来源、观察时间和状态，通过 observation 和 D1 readback 确认落库。

#### Scenario: 错误影片详情
- **WHEN** 返回详情的编号与目标编号不同
- **THEN** 不写入该详情的播放源

### Requirement: 实际播放证据
系统 SHALL 将候选发现、读回成功与实际播放成功分别显示。

#### Scenario: 已发现磁力但尚未播放
- **WHEN** 候选已持久化但没有当前 revision 的播放证据
- **THEN** 显示已发现但未验证

#### Scenario: 完成真实播放
- **WHEN** 真实影片通过 canplay、playing 和至少一秒 currentTime 增长，并且证据绑定当前任务和来源 revision
- **THEN** 保存证据并在管理后台和影片详情显示已验证可播放及检查时间
