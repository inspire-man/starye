# 爬虫反检测能力规范

## ADDED Requirements

### Requirement: 请求头伪装

爬虫 **SHALL** 使用真实浏览器的请求头配置，以避免被目标网站识别为机器人。

#### Scenario: 设置完整的 HTTP 请求头

- **WHEN** 爬虫初始化 Page 对象
- **THEN** 系统应设置以下请求头：
  - `Accept-Language`（如 `zh-CN,zh;q=0.9,en;q=0.8`）
  - `Accept`（支持 HTML、XML、图片等）
  - `Accept-Encoding`（`gzip, deflate, br`）
  - `Referer`（模拟从首页进入）
  - `Sec-Fetch-*` 系列（`Dest`, `Mode`, `Site`）
  - `Upgrade-Insecure-Requests`

#### Scenario: 使用真实的 User-Agent

- **WHEN** 爬虫启动浏览器
- **THEN** 系统应使用真实的 Chrome/Edge User-Agent 字符串
- **AND** User-Agent 应与 Chrome for Testing 版本匹配

### Requirement: Cookie 和 Session 管理

爬虫 **SHALL** 维护 Cookie 上下文，模拟真实用户的浏览会话。

#### Scenario: 初始化爬虫会话

- **WHEN** 开始爬取任务
- **THEN** 系统应先访问目标网站首页
- **AND** 保存服务器返回的所有 Cookie

#### Scenario: 在后续请求中使用 Cookie

- **WHEN** 访问详情页或其他页面
- **THEN** 系统应自动附带已保存的 Cookie
- **AND** Cookie 应在整个爬取会话中保持有效

#### Scenario: 会话超时处理

- **WHEN** Cookie 过期或会话失效
- **THEN** 系统应重新访问首页建立新会话
- **AND** 记录会话重建事件到日志

### Requirement: 智能延迟策略

爬虫 **SHALL** 实现智能延迟机制，使请求间隔更像人类行为。

#### Scenario: 基础延迟

- **WHEN** 发起任何爬取请求
- **THEN** 系统应等待基础延迟时间（可配置，默认 8000ms）
- **AND** 基础延迟 **MUST** 大于 5000ms（避免过快）

#### Scenario: 随机化延迟

- **WHEN** 计算实际延迟时间
- **THEN** 系统应在基础延迟上增加随机时间（可配置范围）
- **AND** 随机范围 **SHOULD** 在 0 到 4000ms 之间

#### Scenario: 错误后增加延迟

- **WHEN** 发生 `ERR_ABORTED` 或连接错误
- **THEN** 系统应将下次延迟时间增加 50%-100%
- **AND** 延迟 **MUST NOT** 超过配置的最大延迟上限

#### Scenario: 成功率自适应延迟

- **WHEN** 成功率低于 70%（最近 20 次请求）
- **THEN** 系统应自动增加延迟时间（乘以 1.5）
- **AND** 在控制台输出警告信息

### Requirement: 成功率监控

爬虫 **SHALL** 实时监控爬取成功率，作为自适应调整的依据。

#### Scenario: 记录请求结果

- **WHEN** 完成一次爬取请求（成功或失败）
- **THEN** 系统应记录结果到滑动窗口（默认大小 20）
- **AND** 窗口 **SHOULD** 只保留最近的结果

#### Scenario: 计算成功率

- **WHEN** 需要评估当前爬取状态
- **THEN** 系统应计算滑动窗口内的成功率
- **AND** 成功率计算公式：`成功次数 / 总次数`

#### Scenario: 输出成功率指标

- **WHEN** 输出爬虫统计信息
- **THEN** 系统 **SHALL** 包含当前成功率数据
- **AND** 格式应为百分比（如 "成功率: 85%"）

### Requirement: 浏览器指纹伪装

爬虫 **SHALL** 最小化浏览器指纹特征，避免被高级反爬虫检测。

#### Scenario: 使用 Stealth 插件

- **WHEN** 初始化 Puppeteer 浏览器
- **THEN** 系统 **MUST** 启用 `puppeteer-extra-plugin-stealth`
- **AND** 插件应自动处理常见的指纹特征（WebDriver、Chrome 对象等）

#### Scenario: 隐藏自动化特征

- **WHEN** 页面加载完成
- **THEN** `navigator.webdriver` **MUST** 返回 `undefined`
- **AND** 不应存在明显的自动化标识符

#### Scenario: 保持浏览器一致性

- **WHEN** 设置 User-Agent
- **THEN** 其他浏览器属性（platform、vendor、language）**SHALL** 与之匹配
- **AND** 不应出现矛盾的浏览器信息
