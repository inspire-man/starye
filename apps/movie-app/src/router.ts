import { createRouter, createWebHistory } from 'vue-router'
import { useToast } from './composables/useToast'
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
      path: '/actors',
      name: 'actors',
      component: () => import('./views/Actors.vue'),
    },
    {
      path: '/actors/:slug',
      name: 'actor-detail',
      component: () => import('./views/ActorDetail.vue'),
    },
    {
      path: '/publishers',
      name: 'publishers',
      component: () => import('./views/Publishers.vue'),
    },
    {
      path: '/publishers/:slug',
      name: 'publisher-detail',
      component: () => import('./views/PublisherDetail.vue'),
    },
    {
      path: '/series/:name',
      name: 'series',
      component: () => import('./views/Series.vue'),
    },
    {
      path: '/movie/:code',
      name: 'movie-detail',
      component: () => import('./views/MovieDetail.vue'),
    },
    {
      path: '/movie/:code/play',
      name: 'player',
      component: () => import('./views/Player.vue'),
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
    {
      path: '/history',
      name: 'history',
      component: () => import('./views/History.vue'),
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
      const { showToast } = useToast()
      showToast('请先登录以访问该页面', 'error')
      next(false)
      return
    }
  }

  next()
})

export default router
