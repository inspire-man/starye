# magnet-link-management Specification

## Purpose
TBD - created by archiving change movie-playback-sources-enhancement. Update Purpose after archive.
## Requirements
### Requirement: 一键复制磁力链接

系统 SHALL 提供一键复制磁力链接的功能，使用浏览器原生 Clipboard API 实现。

#### Scenario: 成功复制磁链
- **WHEN** 用户点击磁力链接旁的"复制"按钮
- **THEN** 系统将完整的 magnet:// 链接复制到剪贴板，并显示"已复制"的 Toast 提示

#### Scenario: 复制失败处理
- **WHEN** 浏览器不支持 Clipboard API 或用户拒绝剪贴板权限
- **THEN** 系统降级为选中文本方式，并提示用户手动复制（Ctrl+C）

#### Scenario: 复制按钮状态反馈
- **WHEN** 用户点击复制按钮后
- **THEN** 按钮文本临时变更为"已复制"，2秒后恢复原状态

### Requirement: 磁力链接协议调用

系统 SHALL 支持通过 magnet:// 协议链接直接调用用户系统的默认 BT 客户端。

#### Scenario: 点击磁力链接
- **WHEN** 用户点击磁力链接文本或"打开"按钮
- **THEN** 系统触发 magnet:// 协议，调用系统默认的 BitTorrent 客户端

#### Scenario: 系统无默认 BT 客户端
- **WHEN** 用户系统未配置默认 BT 客户端
- **THEN** 浏览器显示标准的"选择应用程序"对话框，或显示无法处理该协议的提示

### Requirement: 磁链格式验证

系统 SHALL 验证磁力链接的格式合法性，避免展示无效链接。

#### Scenario: 验证标准磁链格式
- **WHEN** 系统渲染播放源列表时
- **THEN** 仅展示符合 magnet:?xt=urn:btih: 格式的磁力链接

#### Scenario: 处理无效磁链
- **WHEN** 数据库中存在格式错误的磁力链接
- **THEN** 系统在控制台记录警告，并在前端显示"链接格式错误"提示，但不中断页面渲染

### Requirement: 批量复制磁链

系统 SHALL 支持一次性复制影片的所有磁力链接。

#### Scenario: 批量复制多个磁链
- **WHEN** 影片有多个磁力链接，用户点击"复制全部磁链"按钮
- **THEN** 系统将所有磁链以换行符分隔的格式复制到剪贴板

#### Scenario: 批量复制格式
- **WHEN** 执行批量复制操作
- **THEN** 复制内容格式为：`{画质标签} - {来源} \n magnet://... \n\n {下一个...}`

