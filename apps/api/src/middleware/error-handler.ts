import type { Context } from 'hono'
import type { AppEnv } from '../types'
import { HTTPException } from 'hono/http-exception'

export function errorHandler(err: Error, c: Context<AppEnv>) {
  console.error('[API Error]', err)

  if (err instanceof HTTPException) {
    return c.json({
      success: false,
      error: err.message,
    }, err.status)
  }

  return c.json({
    success: false,
    error: 'Internal Server Error',
  }, 500)
}
