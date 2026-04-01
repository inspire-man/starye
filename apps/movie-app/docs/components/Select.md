# Select 自定义下拉选择器

高性能、类型安全的 Vue 3 自定义下拉选择组件，参考 Element Plus 设计。

## 特性

- ✅ **TypeScript 泛型支持**：完整的类型推断和类型安全
- ✅ **键盘导航**：支持上下键、Enter、ESC 操作
- ✅ **响应式位置**：智能计算下拉框位置，自适应屏幕边界
- ✅ **点击外部关闭**：自动检测外部点击
- ✅ **可清空**：可选的清空按钮
- ✅ **多状态**：支持加载、禁用、错误状态
- ✅ **动画过渡**：流畅的展开/收起动画
- ✅ **Teleport 支持**：下拉框渲染到 body，避免层级问题

## 基础用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Select from '@/components/Select.vue'
import type { SelectOption } from '@/components/Select.vue'

const selectedSort = ref('releaseDate')

const sortOptions: SelectOption<string>[] = [
  { label: '发行日期', value: 'releaseDate', icon: '📅' },
  { label: '最近更新', value: 'updatedAt', icon: '🔄' },
  { label: '最新上架', value: 'createdAt', icon: '✨' },
]
</script>

<template>
  <Select
    v-model="selectedSort"
    :options="sortOptions"
    placeholder="选择排序方式"
  />
</template>
```

## API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `modelValue` | `T` | - | 选中值（v-model） |
| `options` | `SelectOption<T>[]` | `[]` | 选项列表 |
| `placeholder` | `string` | `'请选择'` | 占位文本 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `clearable` | `boolean` | `false` | 是否显示清空按钮 |
| `loading` | `boolean` | `false` | 是否加载中 |
| `error` | `boolean` | `false` | 是否错误状态 |
| `size` | `'small' \| 'default' \| 'large'` | `'default'` | 尺寸 |

### SelectOption 接口

```typescript
interface SelectOption<T = any> {
  label: string       // 显示文本
  value: T            // 选项值
  disabled?: boolean  // 是否禁用
  icon?: string       // 图标（emoji 或 class）
}
```

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `update:modelValue` | `(value: T)` | 选中值变化时触发 |
| `change` | `(value: T)` | 选中值变化时触发（同 update） |
| `clear` | `()` | 清空时触发 |
| `blur` | `()` | 失去焦点时触发 |

## 高级用法

### 类型安全的选项

```vue
<script setup lang="ts">
type SortType = 'releaseDate' | 'updatedAt' | 'createdAt'

const selectedSort = ref<SortType>('releaseDate')

// TypeScript 会自动推断类型
const sortOptions: SelectOption<SortType>[] = [
  { label: '发行日期', value: 'releaseDate' },
  { label: '最近更新', value: 'updatedAt' },
  { label: '最新上架', value: 'createdAt' },
]
</script>
```

### 带图标的选项

```vue
<script setup lang="ts">
const options: SelectOption<string>[] = [
  { label: '主页', value: 'home', icon: '🏠' },
  { label: '设置', value: 'settings', icon: '⚙️' },
  { label: '帮助', value: 'help', icon: '❓' },
]
</script>

<template>
  <Select v-model="selected" :options="options" />
</template>
```

### 禁用特定选项

```vue
<script setup lang="ts">
const options: SelectOption<number>[] = [
  { label: '选项 1', value: 1 },
  { label: '选项 2', value: 2, disabled: true }, // 禁用
  { label: '选项 3', value: 3 },
]
</script>
```

### 可清空选择器

```vue
<template>
  <Select
    v-model="selected"
    :options="options"
    clearable
    @clear="handleClear"
  />
</template>

<script setup lang="ts">
function handleClear() {
  console.log('选择已清空')
}
</script>
```

### 加载状态

```vue
<script setup lang="ts">
const loading = ref(true)
const options = ref<SelectOption<string>[]>([])

async function loadOptions() {
  loading.value = true
  try {
    const response = await api.getOptions()
    options.value = response.data
  } finally {
    loading.value = false
  }
}

onMounted(loadOptions)
</script>

<template>
  <Select
    v-model="selected"
    :options="options"
    :loading="loading"
    placeholder="加载中..."
  />
</template>
```

### 错误状态

```vue
<template>
  <Select
    v-model="selected"
    :options="options"
    :error="hasError"
    placeholder="请选择"
  />
</template>
```

### 不同尺寸

```vue
<template>
  <!-- 小尺寸 -->
  <Select v-model="s1" :options="options" size="small" />
  
  <!-- 默认尺寸 -->
  <Select v-model="s2" :options="options" size="default" />
  
  <!-- 大尺寸 -->
  <Select v-model="s3" :options="options" size="large" />
</template>
```

## 键盘操作

| 按键 | 功能 |
|------|------|
| `Enter` / `Space` | 打开/关闭下拉框 |
| `↑` / `↓` | 选择上一个/下一个选项 |
| `Enter` | 确认选择当前高亮项 |
| `Esc` | 关闭下拉框 |
| `Tab` | 关闭下拉框并移动焦点 |

## 样式定制

组件使用 Tailwind CSS 构建，可以通过覆盖 CSS 变量进行定制：

```css
/* 自定义主题色 */
.custom-select {
  --select-primary: #4ade80;
  --select-hover: #22c55e;
  --select-disabled: #9ca3af;
}
```

## 性能优化建议

1. **选项列表缓存**：如果选项不变，使用 `readonly` 或 `Object.freeze()`
```typescript
const options = Object.freeze([
  { label: 'A', value: 1 },
  { label: 'B', value: 2 },
])
```

2. **大量选项**：对于 100+ 选项，考虑使用虚拟滚动或搜索过滤

3. **避免频繁更新**：使用防抖处理 `@change` 事件

## 注意事项

1. **v-model 类型**：确保 `v-model` 的类型与 `SelectOption<T>` 的 `T` 类型一致
2. **选项唯一性**：每个选项的 `value` 必须唯一
3. **Teleport**：下拉框使用 `Teleport` 渲染到 body，确保全局样式正确
4. **移动端**：在移动设备上自动适配触摸操作

## 与原生 select 对比

| 特性 | Select 组件 | 原生 select |
|------|------------|-------------|
| 自定义样式 | ✅ 完全可定制 | ❌ 受限 |
| 键盘导航 | ✅ 完整支持 | ✅ 部分支持 |
| 类型安全 | ✅ 泛型支持 | ❌ 无 |
| 图标支持 | ✅ 支持 | ❌ 不支持 |
| 加载状态 | ✅ 支持 | ❌ 不支持 |
| 响应式位置 | ✅ 智能计算 | ❌ 固定 |
| 性能 | ✅ 优化 | ✅ 原生快 |

## 单元测试覆盖

组件包含 17 个单元测试，覆盖率 100%：

- ✅ 基础渲染
- ✅ v-model 双向绑定
- ✅ 键盘导航
- ✅ 点击外部关闭
- ✅ 清空功能
- ✅ 禁用状态
- ✅ 加载/错误状态
- ✅ 不同尺寸
- ✅ 类型安全

## 示例项目

查看完整示例：
- [Home.vue](../../src/views/Home.vue) - 排序选择器
- [Profile.vue](../../src/views/Profile.vue) - Tab 切换（移动端）
- [Actors.vue](../../src/views/Actors.vue) - 多个筛选器

## 相关组件

- [MobileDrawer](./MobileDrawer.md) - 移动端抽屉菜单
- [BottomNavigation](./BottomNavigation.md) - 底部导航栏

---

**版本**：1.0.0  
**作者**：Starye Team  
**最后更新**：2026-03-31
