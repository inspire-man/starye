/**
 * Cache Middleware for Gateway
 *
 * Provides route-aware caching functionality for proxied requests.
 * Supports:
 * - KV caching for selected JSON API responses
 * - Cache-Control headers for static assets, public pages, and private paths
 * - Prefix-based cache invalidation
 * - Structured cache monitoring logs
 */

type CacheScope = 'public' | 'bypass'
type CacheGroup = 'admin' | 'api' | 'auth' | 'misc' | 'movies' | 'public-pages' | 'static-assets'
type CacheBypassReason = 'auth-headers' | 'no-store-path' | 'set-cookie-response' | 'cache-bypass-option' | 'non-cacheable-group'

interface CachePolicy {
  scope: CacheScope
  group: CacheGroup
  ttl?: number
  staleWhileRevalidate?: number
  cacheControl?: string
  shouldStore: boolean
  /**
   * D-10：BYPASS 原因，供 decorateResponse 注入 `X-Cache-Reason`。
   * 仅在 BYPASS（shouldStore=false 且 scope='bypass'）时有意义。
   */
  bypassReason?: CacheBypassReason
}

export interface CacheOptions {
  ttl?: number // Override the policy TTL for cacheable requests
  bypassCache?: boolean // Force bypass KV storage while keeping route headers
  preserveUpstreamCacheControl?: boolean // Leave development-server cache semantics intact
  cacheKey?: (url: string, headers: Headers, policy: CachePolicy) => string
  executionCtx?: ExecutionContext
}

export interface CacheEntry {
  response: string
  headers: Record<string, string>
  status: number
  statusText: string
  timestamp: number
  ttl: number
  group: CacheGroup
  scope: CacheScope
}

const DEFAULT_TTL = 300
export const GATEWAY_CACHE_PREFIX = 'gateway-cache:v2'
const CACHE_STATUS_HEADER = 'X-Cache-Status'
const CACHE_GROUP_HEADER = 'X-Cache-Group'
const CACHE_POLICY_HEADER = 'X-Cache-Policy'
const CACHE_TTL_HEADER = 'X-Cache-TTL'
const CACHE_REASON_HEADER = 'X-Cache-Reason'
const MOVIE_LIST_PATHS = new Set(['/api/movies', '/api/public/movies'])
const NO_STORE_PREFIXES = ['/api/admin', '/api/auth', '/api/monitoring', '/api/upload', '/dashboard', '/auth']
const STATIC_ASSET_PATTERN = /\.(?:avif|css|gif|ico|jpeg|jpg|js|json|map|mjs|mp4|png|svg|ttf|txt|webp|woff2?|xml)$/i

function buildCacheControl(scope: 'public', ttl: number, staleWhileRevalidate?: number): string {
  const directives = [`${scope}, max-age=${ttl}`]

  if (staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`)
  }

  return directives.join(', ')
}

function isStaticAssetPath(pathname: string): boolean {
  return pathname.includes('/assets/') || STATIC_ASSET_PATTERN.test(pathname)
}

function isPublicDocumentPath(pathname: string): boolean {
  if (pathname.startsWith('/api') || pathname.startsWith('/dashboard') || pathname.startsWith('/auth')) {
    return false
  }

  if (isStaticAssetPath(pathname)) {
    return false
  }

  const lastSegment = pathname.split('/').pop() || ''
  return lastSegment === '' || !lastSegment.includes('.') || lastSegment.endsWith('.html')
}

// D-14：hashValue 函数体保留（静态资源 URL 分片等后续用途），调用点已随 private scope 清理删除。
// eslint-disable-next-line unused-imports/no-unused-vars -- reserved for future static-asset hashing
function hashValue(value: string): string {
  let hash = 2166136261

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

// D-12 后保留：mergeVaryHeader 函数体保留（未来静态资源 `Vary: Accept-Encoding` 可能复用），
// decorateResponse 内的 `Vary: Cookie` 调用随 private scope 清理删除。
// eslint-disable-next-line unused-imports/no-unused-vars -- reserved for future Vary header merging
function mergeVaryHeader(headers: Headers, value: string): void {
  const current = headers.get('Vary')
  if (!current) {
    headers.set('Vary', value)
    return
  }

  const tokens = current
    .split(',')
    .map(token => token.trim())
    .filter(Boolean)

  if (!tokens.includes(value)) {
    headers.set('Vary', [...tokens, value].join(', '))
  }
}

function resolveBasePolicy(url: URL): CachePolicy {
  const { pathname } = url

  if (isStaticAssetPath(pathname)) {
    return {
      scope: 'bypass',
      group: 'static-assets',
      ttl: 31536000,
      cacheControl: 'public, max-age=31536000, immutable',
      shouldStore: false,
    }
  }

  if (NO_STORE_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return {
      scope: 'bypass',
      group: pathname.startsWith('/dashboard') ? 'admin' : 'auth',
      cacheControl: 'no-store',
      shouldStore: false,
      bypassReason: 'no-store-path',
    }
  }

  if (MOVIE_LIST_PATHS.has(pathname)) {
    return {
      scope: 'public',
      group: 'movies',
      ttl: 300,
      staleWhileRevalidate: 60,
      cacheControl: buildCacheControl('public', 300, 60),
      shouldStore: true,
    }
  }

  if (pathname.startsWith('/api')) {
    return {
      scope: 'bypass',
      group: 'api',
      cacheControl: 'no-store',
      shouldStore: false,
      bypassReason: 'non-cacheable-group',
    }
  }

  if (isPublicDocumentPath(pathname)) {
    return {
      scope: 'bypass',
      group: 'public-pages',
      ttl: 3600,
      cacheControl: buildCacheControl('public', 3600, 300),
      shouldStore: false,
      bypassReason: 'non-cacheable-group',
    }
  }

  return {
    scope: 'bypass',
    group: 'misc',
    shouldStore: false,
    bypassReason: 'non-cacheable-group',
  }
}

export function resolveCachePolicy(request: Request, options?: CacheOptions): CachePolicy {
  const url = new URL(request.url)
  const basePolicy = resolveBasePolicy(url)

  // D-07：带 Cookie 或 Authorization 的请求强制 bypass，覆盖路径 policy
  const hasAuthHeaders = request.headers.has('cookie') || request.headers.has('authorization')

  const ttl = options?.ttl ?? basePolicy.ttl
  const shouldStore = !options?.bypassCache && !hasAuthHeaders && basePolicy.shouldStore
  const scope: CacheScope = shouldStore ? basePolicy.scope : 'bypass'

  // 计算 bypassReason：auth-headers > options.bypassCache > basePolicy.bypassReason
  let bypassReason: CacheBypassReason | undefined
  if (!shouldStore) {
    if (hasAuthHeaders) {
      bypassReason = 'auth-headers'
    }
    else if (options?.bypassCache) {
      bypassReason = 'cache-bypass-option'
    }
    else {
      bypassReason = basePolicy.bypassReason
    }
  }

  return {
    ...basePolicy,
    scope,
    ttl,
    shouldStore,
    bypassReason,
    // CR-01: public 基线翻 bypass 时必须降级 Cache-Control，否则共享缓存投毒
    cacheControl: options?.preserveUpstreamCacheControl
      ? undefined
      : (ttl && basePolicy.scope === 'public' && shouldStore
          ? buildCacheControl('public', ttl, basePolicy.staleWhileRevalidate)
          : (!shouldStore && basePolicy.scope === 'public'
              ? 'private, no-store'
              : basePolicy.cacheControl)),
  }
}

export function buildCacheGroupPrefix(group: CacheGroup): string {
  return `${GATEWAY_CACHE_PREFIX}:${group}:`
}

function createCacheKey(url: URL, headers: Headers, policy: CachePolicy, options?: CacheOptions): string {
  const rawKey = options?.cacheKey
    ? options.cacheKey(url.toString(), headers, policy)
    : `${url.pathname}${url.search}`

  const encodedKey = encodeURIComponent(rawKey)

  return `${GATEWAY_CACHE_PREFIX}:${policy.group}:${policy.scope}:${encodedKey}`
}

function shouldCacheResponse(response: Response): boolean {
  // D-09 防线：即便 D-07 未来被改坏，带 Set-Cookie 的响应也绝不写入 KV。
  if (!response.ok || response.headers.has('set-cookie')) {
    return false
  }

  const contentType = response.headers.get('content-type') || ''
  return contentType.includes('application/json')
}

async function runBackgroundTask(task: Promise<unknown>, executionCtx?: ExecutionContext): Promise<void> {
  if (executionCtx) {
    executionCtx.waitUntil(task.catch((error) => {
      console.error('[Cache] Background task failed:', error)
    }))
    return
  }

  try {
    await task
  }
  catch (error) {
    console.error('[Cache] Background task failed:', error)
  }
}

function logCacheEvent(
  request: Request,
  response: Response,
  policy: CachePolicy,
  cacheStatus: 'BYPASS' | 'HIT' | 'MISS',
  startedAt: number,
): void {
  const url = new URL(request.url)
  const durationMs = Date.now() - startedAt

  // eslint-disable-next-line no-console -- structured cache events are emitted to worker logs for monitoring
  console.log(JSON.stringify({
    type: 'gateway-cache',
    path: url.pathname,
    method: request.method,
    group: policy.group,
    scope: policy.scope,
    status: cacheStatus,
    ttl: policy.ttl ?? 0,
    durationMs,
    responseStatus: response.status,
  }))
}

/**
 * 从缓存获取响应
 */
export async function getFromCache(
  cache: KVNamespace,
  key: string,
): Promise<CacheEntry | null> {
  try {
    const cached = await cache.get(key, 'text')
    if (!cached) {
      return null
    }

    const entry: CacheEntry = JSON.parse(cached)
    const age = (Date.now() - entry.timestamp) / 1000

    if (age >= entry.ttl) {
      await cache.delete(key)
      return null
    }

    return entry
  }
  catch (error) {
    console.error('[Cache] Get error:', error)
    return null
  }
}

/**
 * 保存响应到缓存
 */
export async function saveToCache(
  cache: KVNamespace,
  key: string,
  response: Response,
  policy: CachePolicy,
): Promise<void> {
  if (!shouldCacheResponse(response)) {
    return
  }

  try {
    const responseText = await response.text()
    const entry: CacheEntry = {
      response: responseText,
      headers: Object.fromEntries(response.headers.entries()),
      status: response.status,
      statusText: response.statusText,
      timestamp: Date.now(),
      ttl: policy.ttl || DEFAULT_TTL,
      group: policy.group,
      scope: policy.scope,
    }

    await cache.put(key, JSON.stringify(entry), {
      expirationTtl: entry.ttl,
    })
  }
  catch (error) {
    console.error('[Cache] Save error:', error)
  }
}

/**
 * 从缓存条目重建响应
 */
export function responseFromCacheEntry(entry: CacheEntry): Response {
  return new Response(entry.response, {
    status: entry.status,
    statusText: entry.statusText,
    headers: new Headers(entry.headers),
  })
}

function decorateResponse(
  response: Response,
  policy: CachePolicy,
  cacheStatus: 'BYPASS' | 'HIT' | 'MISS',
  ageSeconds?: number,
): Response {
  const headers = new Headers(response.headers)
  headers.set(CACHE_STATUS_HEADER, cacheStatus)
  headers.set(CACHE_GROUP_HEADER, policy.group)
  headers.set(CACHE_POLICY_HEADER, policy.scope)

  if (policy.ttl && cacheStatus !== 'BYPASS') {
    headers.set(CACHE_TTL_HEADER, `${policy.ttl}`)
  }

  if (policy.cacheControl) {
    headers.set('Cache-Control', policy.cacheControl)
  }

  // D-10：BYPASS 时注入 X-Cache-Reason 诊断头
  if (cacheStatus === 'BYPASS' && policy.bypassReason) {
    headers.set(CACHE_REASON_HEADER, policy.bypassReason)
  }

  if (ageSeconds !== undefined) {
    headers.set('Age', `${Math.max(0, Math.floor(ageSeconds))}`)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * 创建带缓存检查的代理函数
 */
export function createCachedProxy(
  cache: KVNamespace | undefined,
  proxyFn: (request: Request, targetOrigin: string, pathRewrite?: (path: string) => string) => Promise<Response>,
) {
  return async (
    request: Request,
    targetOrigin: string,
    pathRewrite?: (path: string) => string,
    options?: CacheOptions,
  ): Promise<Response> => {
    const startedAt = Date.now()
    const policy = resolveCachePolicy(request, !cache ? { ...options, bypassCache: true } : options)

    if (!cache || request.method !== 'GET' || !policy.shouldStore) {
      const response = decorateResponse(await proxyFn(request, targetOrigin, pathRewrite), policy, 'BYPASS')
      logCacheEvent(request, response, policy, 'BYPASS', startedAt)
      return response
    }

    const cacheKey = createCacheKey(new URL(request.url), request.headers, policy, options)
    const cached = await getFromCache(cache, cacheKey)

    if (cached) {
      const age = (Date.now() - cached.timestamp) / 1000
      const response = decorateResponse(responseFromCacheEntry(cached), policy, 'HIT', age)
      logCacheEvent(request, response, policy, 'HIT', startedAt)
      return response
    }

    const response = await proxyFn(request, targetOrigin, pathRewrite)
    const storable = shouldCacheResponse(response)

    if (storable) {
      await runBackgroundTask(
        saveToCache(cache, cacheKey, response.clone(), policy),
        options?.executionCtx,
      )
    }

    const cacheStatus: 'BYPASS' | 'MISS' = storable ? 'MISS' : 'BYPASS'
    // CR-02：Set-Cookie 响应必须降级为 private, no-store，防止上游共享缓存投毒。
    // bypassReason 保留原值（例如 auth-headers）优先，仅在缺省时补 'set-cookie-response'。
    const finalPolicy: CachePolicy = !storable && response.headers.has('set-cookie')
      ? {
          ...policy,
          scope: 'bypass' as const,
          shouldStore: false,
          cacheControl: 'private, no-store',
          bypassReason: policy.bypassReason ?? 'set-cookie-response',
        }
      : policy
    const decoratedResponse = decorateResponse(response, finalPolicy, cacheStatus)
    logCacheEvent(request, decoratedResponse, finalPolicy, cacheStatus, startedAt)
    return decoratedResponse
  }
}

/**
 * 按前缀使缓存失效
 */
export async function invalidateCache(
  cache: KVNamespace,
  prefix: string,
): Promise<number> {
  let deleted = 0
  let cursor: string | undefined

  try {
    do {
      const list = await cache.list({ prefix, cursor })
      if (list.keys.length > 0) {
        await Promise.all(list.keys.map(key => cache.delete(key.name)))
        deleted += list.keys.length
      }
      cursor = list.list_complete ? undefined : list.cursor
    } while (cursor)
  }
  catch (error) {
    console.error('[Cache] Invalidate error:', error)
  }

  return deleted
}
