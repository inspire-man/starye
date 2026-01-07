import type { AppEnv } from '../types'
import { Hono } from 'hono'

const health = new Hono<AppEnv>()

health.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'starye-api',
    timestamp: new Date().toISOString(),
  })
})

export default health
