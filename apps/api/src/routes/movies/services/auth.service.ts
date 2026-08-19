import type { SessionUser } from '../../../types'

export function checkUserAdultStatus(user?: SessionUser): boolean {
  return user?.isAdult === true || user?.isR18Verified === true
}
