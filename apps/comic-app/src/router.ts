import { warning } from '@starye/ui'
import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from './stores/user'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/Home.vue'),
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('./views/Search.vue'),
    },
    {
      path: '/comic/:slug',
      name: 'comic-detail',
      component: () => import('./views/ComicDetail.vue'),
    },
    {
      path: '/comic/:slug/read/:chapterId',
      name: 'reader',
      component: () => import('./views/Reader.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('./views/Profile.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: () => import('./views/Favorites.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

// 路由守卫：保护需要登录的页面
router.beforeEach(async (to, _from, next) => {
  if (to.meta.requiresAuth) {
    const userStore = useUserStore()

    // 确保用户状态已加载
    if (userStore.loading) {
      await new Promise((resolve) => {
        const unwatch = userStore.$subscribe(() => {
          if (!userStore.loading) {
            unwatch()
            resolve(undefined)
          }
        })
      })
    }

    if (!userStore.user) {
      warning('请先登录以访问个人中心')
      next(false)
      return
    }
  }

  next()
})

export default router
