<script setup lang="ts">
import type { QuantView } from '../lib/quant-view'
import {
  BarChart3,
  BookOpen,
  ExternalLink,
  Eye,
  ListFilter,
  Menu,
  RefreshCw,
  X,
} from 'lucide-vue-next'
import { ref } from 'vue'

defineProps<{
  activeView: QuantView
  latestDate: string
  busy: boolean
}>()

const emit = defineEmits<{
  navigate: [view: QuantView]
  refresh: []
}>()

const mobileMenuOpen = ref(false)

const navItems: { key: QuantView, label: string, detail: string, icon: typeof BarChart3 }[] = [
  { key: 'overview', label: '总览', detail: '统计与今日优先关注', icon: BarChart3 },
  { key: 'candidates', label: '候选研究', detail: '筛选、比较与研究动作', icon: ListFilter },
  { key: 'watchlist', label: '观察池', detail: '管理标的与更新数据', icon: Eye },
  { key: 'knowledge', label: '因子框架', detail: '理解评分依据与数据缺口', icon: BookOpen },
]

function selectView(view: QuantView): void {
  mobileMenuOpen.value = false
  emit('navigate', view)
}
</script>

<template>
  <header class="quant-app-header">
    <div class="quant-app-header-inner">
      <a class="quant-brand" href="/quant/" aria-label="返回择股工作台总览" @click.prevent="selectView('overview')">
        <span class="quant-brand-mark">STARYE</span>
        <span class="quant-brand-name">QUANT</span>
      </a>

      <nav class="quant-primary-nav" aria-label="量化工作台导航">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="quant-nav-link"
          :class="activeView === item.key ? 'quant-nav-link-active' : ''"
          type="button"
          :aria-current="activeView === item.key ? 'page' : undefined"
          :title="item.detail"
          @click="selectView(item.key)"
        >
          <component :is="item.icon" :size="15" aria-hidden="true" />
          {{ item.label }}
        </button>
      </nav>

      <div class="quant-app-header-actions">
        <div class="quant-header-date">
          <span>数据截至</span>
          <strong>{{ latestDate }}</strong>
        </div>
        <a class="quant-ops-link" href="/dashboard/" title="打开运管后台">
          <ExternalLink :size="14" aria-hidden="true" />
          <span>运管</span>
        </a>
        <button class="quant-refresh-button" type="button" title="刷新工作台" aria-label="刷新工作台" :disabled="busy" @click="emit('refresh')">
          <RefreshCw :size="16" :class="busy ? 'animate-spin' : ''" aria-hidden="true" />
        </button>
        <button class="quant-mobile-menu-button" type="button" :aria-expanded="mobileMenuOpen" aria-controls="quant-mobile-nav" :aria-label="mobileMenuOpen ? '关闭导航菜单' : '打开导航菜单'" :title="mobileMenuOpen ? '关闭导航菜单' : '打开导航菜单'" @click="mobileMenuOpen = !mobileMenuOpen">
          <X v-if="mobileMenuOpen" :size="19" aria-hidden="true" />
          <Menu v-else :size="19" aria-hidden="true" />
        </button>
      </div>
    </div>

    <nav v-if="mobileMenuOpen" id="quant-mobile-nav" class="quant-mobile-nav" aria-label="移动端量化工作台导航">
      <button
        v-for="item in navItems"
        :key="item.key"
        class="quant-mobile-nav-link"
        :class="activeView === item.key ? 'quant-mobile-nav-link-active' : ''"
        type="button"
        :aria-current="activeView === item.key ? 'page' : undefined"
        @click="selectView(item.key)"
      >
        <component :is="item.icon" :size="16" aria-hidden="true" />
        <span>
          <strong>{{ item.label }}</strong>
          <small>{{ item.detail }}</small>
        </span>
      </button>
    </nav>
  </header>
</template>

<style scoped>
.quant-app-header {
  position: sticky;
  top: 0;
  z-index: 30;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--background) / 0.94);
  box-shadow: 0 1px 10px hsl(var(--foreground) / 0.04);
  backdrop-filter: blur(14px);
}

.quant-app-header-inner {
  display: flex;
  width: min(100%, 1536px);
  min-height: 4rem;
  align-items: center;
  gap: 1.25rem;
  margin: 0 auto;
  padding: 0.5rem clamp(1rem, 3vw, 2.75rem);
}

.quant-brand {
  display: inline-flex;
  flex-shrink: 0;
  align-items: baseline;
  gap: 0.45rem;
  color: hsl(var(--foreground));
  line-height: 1;
  text-decoration: none;
}

.quant-brand-mark {
  color: hsl(var(--primary));
  font-size: 1.08rem;
  font-weight: 850;
  letter-spacing: 0.04em;
}

.quant-brand-name {
  color: hsl(var(--muted-foreground));
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.quant-primary-nav {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.25rem;
}

.quant-nav-link,
.quant-mobile-nav-link,
.quant-refresh-button,
.quant-mobile-menu-button,
.quant-ops-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-md, 0.375rem);
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease, border-color 150ms ease;
}

.quant-nav-link {
  gap: 0.4rem;
  padding: 0.5rem 0.7rem;
  font-size: 0.8125rem;
  font-weight: 650;
  white-space: nowrap;
}

.quant-nav-link:hover,
.quant-nav-link-active {
  border-color: hsl(var(--primary) / 0.12);
  background: hsl(var(--primary) / 0.08);
  color: hsl(var(--primary));
}

.quant-app-header-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.quant-header-date {
  display: grid;
  gap: 0.12rem;
  min-width: 5.5rem;
  border-left: 1px solid hsl(var(--border));
  padding-left: 0.75rem;
}

.quant-header-date span {
  color: hsl(var(--muted-foreground));
  font-size: 0.65rem;
}

.quant-header-date strong {
  color: hsl(var(--foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.75rem;
  font-weight: 750;
  white-space: nowrap;
}

.quant-ops-link {
  gap: 0.3rem;
  padding: 0.45rem 0.55rem;
  font-size: 0.75rem;
  text-decoration: none;
}

.quant-ops-link:hover,
.quant-refresh-button:hover:not(:disabled),
.quant-mobile-menu-button:hover {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.quant-refresh-button,
.quant-mobile-menu-button {
  width: 2.25rem;
  height: 2.25rem;
  background: transparent;
}

.quant-refresh-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.quant-mobile-menu-button {
  display: none;
}

.quant-mobile-nav {
  display: none;
}

@media (max-width: 900px) {
  .quant-primary-nav {
    overflow-x: auto;
    scrollbar-width: none;
  }

  .quant-primary-nav::-webkit-scrollbar {
    display: none;
  }

  .quant-nav-link {
    padding-inline: 0.55rem;
  }

  .quant-ops-link span {
    display: none;
  }
}

@media (max-width: 680px) {
  .quant-app-header-inner {
    min-height: 3.5rem;
    gap: 0.65rem;
    padding-inline: 1rem;
  }

  .quant-primary-nav {
    display: none;
  }

  .quant-header-date {
    min-width: 0;
    padding-left: 0.55rem;
  }

  .quant-header-date span {
    display: none;
  }

  .quant-header-date strong {
    font-size: 0.7rem;
  }

  .quant-mobile-menu-button {
    display: inline-flex;
  }

  .quant-mobile-nav {
    display: grid;
    gap: 0.25rem;
    border-top: 1px solid hsl(var(--border));
    padding: 0.55rem 1rem 0.75rem;
  }

  .quant-mobile-nav-link {
    justify-content: flex-start;
    gap: 0.65rem;
    padding: 0.65rem 0.7rem;
    text-align: left;
  }

  .quant-mobile-nav-link span {
    display: grid;
    gap: 0.12rem;
  }

  .quant-mobile-nav-link strong {
    color: hsl(var(--foreground));
    font-size: 0.8125rem;
  }

  .quant-mobile-nav-link small {
    color: hsl(var(--muted-foreground));
    font-size: 0.6875rem;
  }

  .quant-mobile-nav-link-active {
    background: hsl(var(--primary) / 0.08);
    color: hsl(var(--primary));
  }
}
</style>
