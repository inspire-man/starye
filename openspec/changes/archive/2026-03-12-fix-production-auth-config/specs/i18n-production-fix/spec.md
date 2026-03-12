# Spec: i18n 国际化在生产环境的修复

## ADDED Requirements

### Requirement: Auth 应用移除未使用的 i18n 模块

Auth 应用 **SHALL NOT** 加载 `@nuxtjs/i18n` 模块，以避免尝试加载不存在的翻译文件导致 404 错误。

#### Scenario: nuxt.config.ts 不包含 i18n 模块
- **WHEN** 查看 `apps/auth/nuxt.config.ts`
- **THEN** 配置文件 **SHALL NOT** 在 `modules` 数组中包含 `'@nuxtjs/i18n'`
- **AND** 配置文件 **SHALL NOT** 包含 `i18n` 配置对象

#### Scenario: 生产构建无 i18n 文件请求
- **WHEN** 访问生产环境的 `https://starye.org/auth/login`
- **THEN** 浏览器网络请求 **SHALL NOT** 包含 `/_i18n/` 路径的请求
- **AND** 浏览器控制台 **SHALL NOT** 显示 i18n 相关的 404 错误

#### Scenario: Vite optimizeDeps 不排除 locales 包
- **WHEN** 查看 `apps/auth/nuxt.config.ts` 的 `vite.optimizeDeps.exclude` 配置
- **THEN** 配置 **SHALL NOT** 包含 `'@starye/locales'`

---

### Requirement: Auth 应用功能不受影响

移除 i18n 模块 **SHALL NOT** 影响 Auth 应用的核心功能。

#### Scenario: 登录页正常显示
- **WHEN** 访问 `https://starye.org/auth/login`
- **THEN** 页面 **SHALL** 正常渲染所有 UI 元素
- **AND** 页面 **SHALL** 显示 "STARYE ID" 标题
- **AND** 页面 **SHALL** 显示 "Login with GitHub" 按钮

#### Scenario: 登录功能正常工作
- **WHEN** 用户点击 "Login with GitHub" 按钮
- **THEN** 应用 **SHALL** 正确跳转到 GitHub OAuth 页面
- **AND** GitHub 授权后 **SHALL** 正确回调到 Auth 应用
- **AND** 登录成功后 **SHALL** 正确跳转到原始页面

#### Scenario: 无 JavaScript 错误
- **WHEN** 访问 `https://starye.org/auth/login`
- **THEN** 浏览器控制台 **SHALL NOT** 显示 JavaScript 错误
- **AND** 浏览器控制台 **SHALL NOT** 显示 `$t is not defined` 错误
- **AND** 浏览器控制台 **SHALL NOT** 显示 `useI18n is not defined` 错误

---

### Requirement: 其他应用的 i18n 不受影响

修复 **SHALL** 仅影响 Auth 应用，其他应用（如 blog, comic, movie）的 i18n 配置 **SHALL** 保持不变。

#### Scenario: Blog 应用 i18n 正常（如有）
- **WHEN** 查看 `apps/blog/nuxt.config.ts`
- **THEN** 如果应用使用 i18n，配置 **SHALL** 保持不变

#### Scenario: Comic 应用 i18n 正常（如有）
- **WHEN** 查看 `apps/comic/nuxt.config.ts`
- **THEN** 如果应用使用 i18n，配置 **SHALL** 保持不变

---

### Requirement: i18n 依赖保留（可选）

`@nuxtjs/i18n` 和 `@starye/locales` 依赖 **MAY** 保留在 `package.json` 中，但不被加载和使用。

#### Scenario: 依赖存在但未使用
- **WHEN** 查看 `apps/auth/package.json`
- **THEN** `@nuxtjs/i18n` **MAY** 存在于 `devDependencies`
- **AND** `@starye/locales` **MAY** 存在于 `dependencies`
- **BUT** 这些依赖 **SHALL NOT** 影响应用运行时行为

#### Scenario: 未来重新启用 i18n（可选）
- **WHEN** 未来需要为 Auth 应用添加多语言支持
- **THEN** 可以重新配置 `@nuxtjs/i18n` 模块
- **AND** 添加适当的翻译文件或内联 `messages`
