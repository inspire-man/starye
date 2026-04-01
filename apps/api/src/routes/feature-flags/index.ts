/**
 * Feature Flags API 路由
 */

import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { getAllFeatureFlags } from '../../utils/featureFlags'

const featureFlagsRouter = new Hono<AppEnv>()

// 获取所有 Feature Flags
featureFlagsRouter.get('/', (c) => {
  const flags = getAllFeatureFlags()

  return c.json({
    code: 0,
    data: flags,
  })
})

export default featureFlagsRouter
