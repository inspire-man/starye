# MobileDrawer 移动端抽屉菜单

从左侧滑出的抽屉式菜单组件，参考 Element Plus Drawer 设计，专为移动端优化。

## 特性

- ✅ **从左侧滑出**：流畅的滑入/滑出动画
- ✅ **插槽系统**：header、default、footer 插槽
- ✅ **遮罩层**：半透明背景，点击关闭
- ✅ **滚动锁定**：打开时锁定背景滚动
- ✅ **ESC 键关闭**：键盘快捷键支持
- ✅ **生命周期钩子**：完整的打开/关闭事件
- ✅ **beforeClose 验证**：支持关闭前确认
- ✅ **Teleport**：渲染到 body，避免层级问题

## 基础用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import MobileDrawer from '@/components/MobileDrawer.vue'

const drawerVisible = ref(false)

function openDrawer() {
  drawerVisible.value = true
}

function closeDrawer() {
  drawerVisible.value = false
}
</script>

<template>
  <button @click="openDrawer">
    打开抽屉
  </button>

  <MobileDrawer v-model="drawerVisible" title="菜单">
    <p>这是抽屉内容</p>
  </MobileDrawer>
</template>
```

## API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `modelValue` | `boolean` | `false` | 是否显示抽屉（v-model） |
| `title` | `string` | - | 抽屉标题 |
| `width` | `string` | `'80vw'` | 抽屉宽度（CSS 值） |
| `maxWidth` | `string` | `'400px'` | 最大宽度 |
| `closeOnClickModal` | `boolean` | `true` | 点击遮罩是否关闭 |
| `closeOnPressEscape` | `boolean` | `true` | ESC 键是否关闭 |
| `lockScroll` | `boolean` | `true` | 是否锁定背景滚动 |
| `showClose` | `boolean` | `true` | 是否显示关闭按钮 |
| `beforeClose` | `(done: () => void) => void` | - | 关闭前回调 |
| `zIndex` | `number` | `9999` | 层级 |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `update:modelValue` | `(visible: boolean)` | 显示状态变化 |
| `open` | `()` | 打开动画开始时触发 |
| `opened` | `()` | 打开动画结束后触发 |
| `close` | `()` | 关闭动画开始时触发 |
| `closed` | `()` | 关闭动画结束后触发 |

### Slots

| 插槽名 | 说明 |
|--------|------|
| `header` | 自定义头部内容（替代 title） |
| `default` | 主体内容 |
| `footer` | 底部内容 |

## 高级用法

### 自定义头部

```vue
<template>
  <MobileDrawer v-model="visible">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold">自定义标题</h3>
        <span class="text-sm text-gray-400">副标题</span>
      </div>
    </template>
    
    <p>内容区域</p>
  </MobileDrawer>
</template>
```

### 自定义底部

```vue
<template>
  <MobileDrawer v-model="visible" title="确认操作">
    <p>确定要执行此操作吗？</p>
    
    <template #footer>
      <div class="flex gap-3">
        <button @click="visible = false">
          取消
        </button>
        <button @click="handleConfirm">
          确认
        </button>
      </div>
    </template>
  </MobileDrawer>
</template>
```

### 关闭前确认

```vue
<script setup lang="ts">
const visible = ref(true)
const hasUnsavedChanges = ref(true)

function beforeClose(done: () => void) {
  if (hasUnsavedChanges.value) {
    if (confirm('有未保存的更改，确定要关闭吗？')) {
      done()
    }
  } else {
    done()
  }
}
</script>

<template>
  <MobileDrawer
    v-model="visible"
    :before-close="beforeClose"
  >
    <p>内容...</p>
  </MobileDrawer>
</template>
```

### 自定义宽度

```vue
<template>
  <!-- 50% 宽度，最大 300px -->
  <MobileDrawer
    v-model="visible"
    width="50vw"
    max-width="300px"
  >
    <p>窄抽屉</p>
  </MobileDrawer>

  <!-- 90% 宽度，最大 500px -->
  <MobileDrawer
    v-model="visible"
    width="90vw"
    max-width="500px"
  >
    <p>宽抽屉</p>
  </MobileDrawer>
</template>
```

### 禁用遮罩关闭

```vue
<template>
  <MobileDrawer
    v-model="visible"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <p>只能通过按钮关闭</p>
    <button @click="visible = false">关闭</button>
  </MobileDrawer>
</template>
```

### 生命周期事件

```vue
<template>
  <MobileDrawer
    v-model="visible"
    @open="handleOpen"
    @opened="handleOpened"
    @close="handleClose"
    @closed="handleClosed"
  >
    <p>监听所有生命周期事件</p>
  </MobileDrawer>
</template>

<script setup lang="ts">
function handleOpen() {
  console.log('开始打开动画')
}

function handleOpened() {
  console.log('打开动画完成')
  // 可以在这里聚焦输入框等
}

function handleClose() {
  console.log('开始关闭动画')
}

function handleClosed() {
  console.log('关闭动画完成')
  // 可以在这里清理数据
}
</script>
```

## 实际应用示例

### App.vue 中的菜单抽屉

```vue
<script setup lang="ts">
import { ref } from 'vue'
import MobileDrawer from './components/MobileDrawer.vue'
import DrawerFooter from './components/DrawerFooter.vue'
import { useDrawer } from './composables/useDrawer'

const { isOpen, open, close } = useDrawer()

const menuItems = [
  { label: '首页', path: '/', icon: '🏠' },
  { label: '厂商', path: '/publishers', icon: '🏢' },
  { label: '收藏夹', path: '/favorites', icon: '⭐' },
]
</script>

<template>
  <!-- 汉堡菜单按钮 -->
  <button @click="open">☰</button>

  <!-- 抽屉菜单 -->
  <MobileDrawer v-model="isOpen" title="菜单" width="80vw" max-width="400px">
    <!-- 菜单项 -->
    <nav class="flex flex-col">
      <RouterLink
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-3 px-6 py-4 hover:bg-gray-700 transition-colors"
        @click="close"
      >
        <span class="text-xl">{{ item.icon }}</span>
        <span class="font-medium">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <!-- 底部信息 -->
    <template #footer>
      <DrawerFooter />
    </template>
  </MobileDrawer>
</template>
```

## 样式类名

| 类名 | 说明 |
|------|------|
| `.mobile-drawer` | 抽屉容器 |
| `.drawer-mask` | 遮罩层 |
| `.drawer-content` | 抽屉内容区 |
| `.drawer-header` | 头部区域 |
| `.drawer-body` | 主体区域 |
| `.drawer-footer` | 底部区域 |
| `.drawer-close` | 关闭按钮 |

## 无障碍支持

- ✅ **键盘导航**：ESC 键关闭
- ✅ **焦点管理**：打开时自动聚焦，关闭时恢复焦点
- ✅ **ARIA 标签**：完整的可访问性标签
- ✅ **语义化 HTML**：使用正确的 HTML 标签

## 性能考虑

1. **Teleport 到 body**：避免层级问题，确保正确渲染
2. **滚动锁定**：防止背景滚动影响用户体验
3. **CSS Transform**：使用 `transform` 实现动画，性能最优
4. **条件渲染**：关闭时销毁内容，减少 DOM 节点

## 浏览器兼容性

- ✅ Chrome 90+
- ✅ Safari 14+
- ✅ Firefox 88+
- ✅ Edge 90+

## 故障排除

### 问题：抽屉无法关闭

**原因**：`beforeClose` 钩子未调用 `done()`

**解决**：确保在 `beforeClose` 中调用 `done()`
```typescript
function beforeClose(done: () => void) {
  // 执行验证...
  done() // 必须调用
}
```

### 问题：滚动穿透

**原因**：`lockScroll` 被禁用

**解决**：启用 `lockScroll` 属性（默认已启用）

### 问题：层级问题

**原因**：其他元素的 z-index 过高

**解决**：调整 `zIndex` 属性
```vue
<MobileDrawer v-model="visible" :z-index="10000" />
```

## 相关资源

- [Element Plus Drawer](https://element-plus.org/zh-CN/component/drawer.html)
- [useDrawer Composable](../composables/useDrawer.md)
- [DrawerFooter 组件](./DrawerFooter.md)

---

**版本**：1.0.0  
**作者**：Starye Team  
**最后更新**：2026-03-31
