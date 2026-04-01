# DrawerFooter 抽屉底部组件

显示在移动端抽屉菜单底部的信息栏，包含 R18 状态、用户信息和登出按钮。

## 特性

- ✅ **R18 状态显示**：详细的 R18 权限状态卡片
- ✅ **用户信息**：当前登录用户名和邮箱
- ✅ **登出功能**：一键退出登录
- ✅ **响应式设计**：自适应移动端布局
- ✅ **状态指示器**：清晰的开启/关闭状态

## 基础用法

```vue
<script setup lang="ts">
import DrawerFooter from '@/components/DrawerFooter.vue'
</script>

<template>
  <MobileDrawer v-model="drawerVisible">
    <!-- 主体内容 -->
    <nav>
      <!-- 菜单项 -->
    </nav>

    <!-- 底部信息 -->
    <template #footer>
      <DrawerFooter />
    </template>
  </MobileDrawer>
</template>
```

## API

### Props

无 Props，组件自动从 Pinia Store 获取用户信息。

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `logout` | `()` | 点击登出时触发 |

## 显示内容

### 1. R18 状态卡片

显示用户的 R18 内容访问权限：

```
┌─────────────────────────┐
│ 🔞 R18 内容              │
│ ● 已开启                 │
│ 可以查看所有成人内容      │
└─────────────────────────┘
```

状态说明：
- **已开启**（绿色 ●）：用户可以访问 R18 内容
- **已关闭**（红色 ●）：用户无法访问 R18 内容

### 2. 用户信息区域

显示当前登录用户的基本信息：

```
👤 用户名
   user@example.com
```

### 3. 登出按钮

```
┌─────────────────────────┐
│      🚪 退出登录          │
└─────────────────────────┘
```

## 完整示例

### 在 App.vue 中使用

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import MobileDrawer from './components/MobileDrawer.vue'
import DrawerFooter from './components/DrawerFooter.vue'
import { useUserStore } from './stores/user'

const drawerVisible = ref(false)
const router = useRouter()
const userStore = useUserStore()

// 处理登出
async function handleLogout() {
  try {
    await userStore.logout()
    drawerVisible.value = false
    router.push('/login')
  } catch (e) {
    console.error('登出失败:', e)
  }
}
</script>

<template>
  <MobileDrawer v-model="drawerVisible" title="菜单">
    <!-- 导航菜单 -->
    <nav class="flex-1">
      <RouterLink
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        @click="drawerVisible = false"
      >
        {{ item.label }}
      </RouterLink>
    </nav>

    <!-- 底部信息（使用插槽） -->
    <template #footer>
      <DrawerFooter @logout="handleLogout" />
    </template>
  </MobileDrawer>
</template>
```

## 依赖

### Pinia Store

组件依赖 `useUserStore` 获取用户数据：

```typescript
// stores/user.ts
export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const r18Enabled = computed(() => user.value?.r18Enabled ?? false)
  
  return { user, r18Enabled }
})
```

### 必需的用户数据字段

```typescript
interface User {
  id: string
  name: string
  email: string
  r18Enabled: boolean  // R18 权限状态
}
```

## 样式定制

### 修改卡片样式

```vue
<style scoped>
/* 自定义 R18 卡片颜色 */
.r18-card.enabled {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.r18-card.disabled {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}
</style>
```

### 调整布局间距

```vue
<style scoped>
.drawer-footer {
  gap: 1rem; /* 默认 1rem (16px) */
  padding: 1.5rem; /* 默认 1.5rem (24px) */
}
</style>
```

## 样式类名

| 类名 | 说明 |
|------|------|
| `.drawer-footer` | 底部容器 |
| `.r18-card` | R18 状态卡片 |
| `.r18-card.enabled` | R18 已开启 |
| `.r18-card.disabled` | R18 已关闭 |
| `.user-info` | 用户信息区域 |
| `.logout-button` | 登出按钮 |

## 事件处理

### 监听登出事件

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

async function handleLogout() {
  // 显示确认对话框
  if (!confirm('确定要退出登录吗？')) {
    return
  }

  try {
    // 调用登出 API
    await userStore.logout()
    
    // 清理本地存储
    localStorage.clear()
    
    // 跳转到登录页
    router.push('/login')
    
    // 显示提示
    showToast('已退出登录')
  } catch (e) {
    console.error('登出失败:', e)
    showToast('登出失败，请重试', 'error')
  }
}
</script>

<template>
  <DrawerFooter @logout="handleLogout" />
</template>
```

## R18 状态管理

### 切换 R18 状态

```typescript
// stores/user.ts
export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  
  async function toggleR18() {
    if (!user.value) return
    
    try {
      const response = await api.put('/api/user/r18', {
        enabled: !user.value.r18Enabled
      })
      
      if (response.data.success) {
        user.value.r18Enabled = !user.value.r18Enabled
      }
    } catch (e) {
      console.error('切换 R18 状态失败:', e)
    }
  }
  
  return { user, toggleR18 }
})
```

### 在组件中添加切换按钮

```vue
<script setup lang="ts">
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

async function handleToggleR18() {
  await userStore.toggleR18()
  showToast('R18 状态已更新')
}
</script>

<template>
  <DrawerFooter @logout="handleLogout">
    <!-- 可以扩展 R18 卡片，添加切换按钮 -->
    <template #r18-actions>
      <button @click="handleToggleR18">
        切换
      </button>
    </template>
  </DrawerFooter>
</template>
```

## 单元测试

组件包含 9 个单元测试：

- ✅ 基础渲染
- ✅ R18 状态显示（开启/关闭）
- ✅ 用户信息显示
- ✅ 登出按钮点击
- ✅ 无用户时的显示

## 无障碍支持

- ✅ **语义化标签**：使用 `<footer>` 标签
- ✅ **按钮标签**：登出按钮有明确的文本
- ✅ **状态指示**：R18 状态有视觉和文本双重指示
- ✅ **对比度**：所有文本符合 WCAG AA 标准

## 注意事项

1. **用户数据**：组件依赖 Pinia Store，确保 Store 已初始化
2. **登出处理**：需要在父组件中监听 `@logout` 事件
3. **R18 状态**：确保用户对象包含 `r18Enabled` 字段
4. **移动端专用**：通常只在移动端抽屉中使用

## 相关组件

- [MobileDrawer](./MobileDrawer.md) - 抽屉菜单容器
- [useUserStore](../stores/user.md) - 用户状态管理

---

**版本**：1.0.0  
**作者**：Starye Team  
**最后更新**：2026-03-31
