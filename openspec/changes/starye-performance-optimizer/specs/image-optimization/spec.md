## ADDED Requirements

### Requirement: 图片格式转换
系统 SHALL 支持将上传的图片转换为 WebP 格式，以减少文件大小。

#### Scenario: 图片自动转换
- **WHEN** 用户上传图片文件
- **THEN** 系统 SHALL 自动转换为 WebP 格式
- **AND** SHALL 保留原始图片作为备份
- **AND** WebP 图片大小 SHALL 比原始图片小 30%以上

#### Scenario: 格式兼容性
- **WHEN** 客户端不支持 WebP 格式
- **THEN** SHALL 自动降级到原始格式
- **AND** SHALL 通过 Accept 头判断客户端支持

### Requirement: 响应式图片
系统 SHALL 根据设备和屏幕尺寸提供不同尺寸的图片。

#### Scenario: 设备适配
- **WHEN** 移动设备请求图片
- **THEN** SHALL 提供小尺寸图片（宽度不超过 800px）
- **AND** WHEN 桌面设备请求
- **THEN** SHALL 提供标准尺寸图片

#### Scenario: 高 DPI 支持
- **WHEN** 高 DPI 设备请求图片
- **THEN** SHALL 提供 2x 尺寸图片
- **AND** SHALL 使用 srcset 属性

### Requirement: 图片懒加载
系统 SHALL 实现图片懒加载，减少首屏加载时间。

#### Scenario: 懒加载触发
- **WHEN** 图片进入视口 200px 范围内
- **THEN** SHALL 开始加载图片
- **AND** SHALL 显示加载占位符

#### Scenario: 预加载关键图片
- **WHEN** 页面首屏包含关键图片
- **THEN** SHALL 使用 preload 预加载
- **AND** 优先级 SHALL 设置为 high

### Requirement: 图片压缩质量配置
系统 SHALL 支持可配置的图片压缩质量。

#### Scenario: 质量配置
- **WHEN** 配置质量参数为 80
- **THEN** 图片质量 SHALL 保持 80%
- **AND** 文件大小 SHALL 最小化

#### Scenario: 不同场景质量
- **WHEN** 封面图片处理
- **THEN** 质量 SHALL 设置为 90%
- **AND** WHEN 缩略图处理
- **THEN** 质量 SHALL 设置为 70%

### Requirement: CDN 图片优化
系统 SHALL 与 CDN 集成，实现图片的自动优化。

#### Scenario: CDN 参数优化
- **WHEN** CDN 接收图片请求
- **THEN** SHALL 自动应用优化参数
- **AND** SHALL 支持格式转换（webp/avif）
- **AND** SHALL 支持尺寸调整

#### Scenario: 缓存控制
- **WHEN** CDN 处理优化后的图片
- **THEN** SHALL 设置合适的 Cache-Control 头
- **AND** SHALL 支持 Vary: Accept 头