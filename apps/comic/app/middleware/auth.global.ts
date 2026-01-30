import { useSession } from '~/lib/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  // Allow access to login page
  if (to.path === '/login')
    return

  const session = useSession()

  // If session is not active, redirect to login
  if (!session.value.data) {
    return navigateTo('/login')
  }

  const user = session.value.data.user
  const role = user.role
  const allowedRoles = ['super_admin', 'admin', 'comic_admin']

  // Check if user has required role
  if (!role || !allowedRoles.includes(role)) {
    return navigateTo('/login?error=insufficient_permissions')
  }
})
