import { createRouter, createWebHistory } from 'vue-router'
import { useAuthGuard } from './composables/useAuthGuard'
import { comicPublicRuntime } from './config/public-runtime'
import { useUserStore } from './stores/user'

const router = createRouter({
  history: createWebHistory(comicPublicRuntime.appBasePath),
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
      path: '/:slug',
      name: 'comic-detail',
      component: () => import('./views/ComicDetail.vue'),
    },
    {
      path: '/:slug/read/:chapterId',
      name: 'reader',
      component: () => import('./views/Reader.vue'),
    },
    // Keep previously generated /comic/:slug URLs working while the base path owns /comic.
    {
      path: '/comic/:slug',
      redirect: to => ({ name: 'comic-detail', params: { slug: to.params.slug } }),
    },
    {
      path: '/comic/:slug/read/:chapterId',
      redirect: to => ({ name: 'reader', params: { slug: to.params.slug, chapterId: to.params.chapterId } }),
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
router.beforeEach(async (to) => {
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
      const { requireLogin } = useAuthGuard()
      requireLogin(`/comic${to.fullPath}`)
      return false
    }
  }

  return true
})

export default router
