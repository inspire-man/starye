/**
 * 重试工具类
 */

export interface RetryOptions {
  maxRetries: number
  retryDelay: number
  exponentialBase: number
  onRetry?: (attempt: number, error: Error) => void
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  retryDelay: 2000,
  exponentialBase: 1.5,
}

/**
 * 带重试的异步函数执行
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    }
    catch (error) {
      lastError = error as Error

      if (attempt < opts.maxRetries) {
        const delay = opts.retryDelay * opts.exponentialBase ** attempt

        if (opts.onRetry) {
          opts.onRetry(attempt + 1, lastError)
        }

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase()

  // 网络错误
  if (message.includes('timeout'))
    return true
  if (message.includes('econnreset'))
    return true
  if (message.includes('econnrefused'))
    return true
  if (message.includes('etimedout'))
    return true
  if (message.includes('fetch failed'))
    return true

  // 服务器错误
  if (message.includes('500'))
    return true
  if (message.includes('502'))
    return true
  if (message.includes('503'))
    return true
  if (message.includes('504'))
    return true

  return false
}

/**
 * 带条件重试的异步函数执行
 */
export async function withConditionalRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    }
    catch (error) {
      lastError = error as Error

      // 只有可重试的错误才重试
      if (attempt < opts.maxRetries && isRetryableError(lastError)) {
        const delay = opts.retryDelay * opts.exponentialBase ** attempt

        if (opts.onRetry) {
          opts.onRetry(attempt + 1, lastError)
        }

        await new Promise(resolve => setTimeout(resolve, delay))
      }
      else {
        throw lastError
      }
    }
  }

  throw lastError
}
