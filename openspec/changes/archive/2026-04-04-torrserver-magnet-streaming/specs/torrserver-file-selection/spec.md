## ADDED Requirements

### Requirement: 自动选择最大视频文件
系统 MUST 在种子包含多个文件时，自动选择最大的视频文件（按扩展名 .mp4/.mkv/.avi/.ts/.wmv/.flv 识别）作为默认播放文件。

#### Scenario: 单视频文件种子
- **WHEN** 种子文件列表中仅有一个视频文件（如 `movie.mp4` 2.1GB + `cover.jpg` 500KB + `subs.srt` 50KB）
- **THEN** 系统自动选择 `movie.mp4`（index=0），无需用户交互

#### Scenario: 多视频文件种子 — 大小差异明显
- **WHEN** 种子包含 `main.mp4`（4.5GB）和 `sample.mp4`（50MB）
- **THEN** 系统自动选择最大的 `main.mp4`，无需用户交互

#### Scenario: 多视频文件种子 — 大小接近
- **WHEN** 种子包含 `part1.mp4`（2.1GB）和 `part2.mp4`（2.0GB），大小差异 < 10%
- **THEN** 系统弹出文件选择对话框，列出所有视频文件及其大小，用户手动选择

#### Scenario: 无视频文件
- **WHEN** 种子文件列表中没有任何视频扩展名的文件
- **THEN** 系统显示 "该种子中未找到视频文件" 错误提示，不跳转到播放页面

### Requirement: 文件选择对话框
系统 SHALL 提供文件选择 UI，在自动选择不确定时供用户手动选择播放文件。

#### Scenario: 显示文件选择对话框
- **WHEN** 系统检测到需要用户手动选择文件
- **THEN** 弹出 Modal 对话框，列出所有视频文件，每项显示：文件名、文件大小（格式化）、文件索引

#### Scenario: 用户选择文件后开始播放
- **WHEN** 用户在文件选择对话框中点击某个文件
- **THEN** 系统使用选中文件的 index 构建流 URL 并跳转到 Player.vue 播放
