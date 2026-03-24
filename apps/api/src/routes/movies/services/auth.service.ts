import type { Auth } from '../../../lib/auth'
import type { SessionUser } from '../../../types'

export interface CheckUserAdultStatusOptions {
  auth: Auth
  headers: Headers
}

export async function checkUserAdultStatus(options: CheckUserAdultStatusOptions): Promise<boolean> {
  const { auth, headers } = options
  const session = await auth.api.getSession({ headers })
  const user = session?.user as SessionUser | undefined
  return user?.isAdult === true
}
