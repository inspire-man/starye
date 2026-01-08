# 开发文档 (Development Documentation)

本文档旨在规范 Starye 项目的开发流程与代码风格，确保代码库的可维护性与一致性。

## 代码注释规范 (Comment Standards)

为了保持代码整洁并确保协作效率，请严格遵循以下注释规范：

### 1. 语言要求 (Language)
所有代码注释、文档说明、TODO 标记必须使用 **简体中文**。

### 2. 标准格式 (Format)
- **公共接口 (Public Interfaces)**: 导出的函数、类、接口、类型定义必须使用 **JSDoc/TSDoc** 格式 (`/** ... */`)。
- **行内注释 (Inline)**: 仅在逻辑内部使用双斜杠 (`//`) 进行简要说明。

### 3. 核心原则 (Principles)
- **关键点注释**: 仅在逻辑复杂、业务规则特殊、算法难懂或使用了非常规 Hack 手段时添加注释。
- **拒绝废话**: 禁止翻译代码本身（例如：不要写 `i++ // i 加 1`）。
- **文档化**: API 路由处理函数应简要说明其功能、输入参数及权限要求。

### 4. 示例 (Examples)

#### 推荐 (Good)

```ts
/**
 * 计算漫画章节的解锁费用
 *
 * 基于用户等级和章节的新旧程度动态计算
 * @param chapterId 章节ID
 * @param userLevel 用户等级 (0-5)
 * @returns 需要消耗的积分数量
 */
function calculateUnlockCost(chapterId: string, userLevel: number): number {
  const baseCost = 10

  // VIP 用户 (等级 > 3) 享受半价优惠
  if (userLevel > 3) {
    return baseCost * 0.5
  }

  return baseCost
}
```

#### 不推荐 (Bad)

```ts
// 计算函数
function calculate(id: string, level: number) {
  const cost = 10 // 定义基础费用
  // 如果等级大于3
  if (level > 3) {
    return cost * 0.5 // 返回一半
  }
  return cost
}
```
