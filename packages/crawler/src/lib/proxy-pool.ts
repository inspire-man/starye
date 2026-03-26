/* eslint-disable node/prefer-global/process */
/* eslint-disable no-console */
/**
 * 代理池管理
 *
 * 功能：
 * - 管理多个代理服务器
 * - 健康检查
 * - 自动故障切换
 * - 轮询或故障时切换策略
 */

export interface ProxyConfig {
  host: string
  port: number
  protocol: 'http' | 'https' | 'socks5'
  username?: string
  password?: string
}

export interface ProxyHealth {
  proxy: ProxyConfig
  isHealthy: boolean
  lastCheckAt: Date
  consecutiveFailures: number
  averageLatency: number
}

export type RotationStrategy = 'round-robin' | 'on-failure' | 'least-latency'

export interface ProxyPoolConfig {
  proxies: ProxyConfig[]
  strategy: RotationStrategy
  healthCheckInterval: number // 毫秒
  healthCheckTimeout: number // 毫秒
  maxConsecutiveFailures: number
  testUrl: string
}

export class ProxyPool {
  private proxies: ProxyConfig[]
  private healthMap: Map<string, ProxyHealth>
  private currentIndex: number
  private strategy: RotationStrategy
  private config: ProxyPoolConfig
  private healthCheckTimer?: NodeJS.Timeout

  constructor(config: ProxyPoolConfig) {
    this.proxies = config.proxies
    this.strategy = config.strategy
    this.config = config
    this.currentIndex = 0
    this.healthMap = new Map()

    // 初始化健康状态
    for (const proxy of this.proxies) {
      const key = this.getProxyKey(proxy)
      this.healthMap.set(key, {
        proxy,
        isHealthy: true,
        lastCheckAt: new Date(),
        consecutiveFailures: 0,
        averageLatency: 0,
      })
    }
  }

  /**
   * 获取代理的唯一标识
   */
  private getProxyKey(proxy: ProxyConfig): string {
    return `${proxy.protocol}://${proxy.host}:${proxy.port}`
  }

  /**
   * 获取下一个可用代理
   */
  getNext(): ProxyConfig | null {
    const healthyProxies = this.getHealthyProxies()

    if (healthyProxies.length === 0) {
      console.warn('[ProxyPool] ⚠️ No healthy proxies available')
      return null
    }

    switch (this.strategy) {
      case 'round-robin':
        return this.getRoundRobinProxy(healthyProxies)

      case 'least-latency':
        return this.getLeastLatencyProxy(healthyProxies)

      case 'on-failure':
      default:
        return healthyProxies[0]
    }
  }

  /**
   * 轮询策略
   */
  private getRoundRobinProxy(healthyProxies: ProxyConfig[]): ProxyConfig {
    const proxy = healthyProxies[this.currentIndex % healthyProxies.length]
    this.currentIndex++
    return proxy
  }

  /**
   * 最低延迟策略
   */
  private getLeastLatencyProxy(healthyProxies: ProxyConfig[]): ProxyConfig {
    let bestProxy = healthyProxies[0]
    let bestLatency = Number.POSITIVE_INFINITY

    for (const proxy of healthyProxies) {
      const key = this.getProxyKey(proxy)
      const health = this.healthMap.get(key)
      if (health && health.averageLatency < bestLatency) {
        bestLatency = health.averageLatency
        bestProxy = proxy
      }
    }

    return bestProxy
  }

  /**
   * 标记代理失败
   */
  markFailure(proxy: ProxyConfig): void {
    const key = this.getProxyKey(proxy)
    const health = this.healthMap.get(key)

    if (health) {
      health.consecutiveFailures++
      health.lastCheckAt = new Date()

      if (health.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        health.isHealthy = false
        console.warn(`[ProxyPool] ❌ Proxy marked unhealthy: ${key}`)
      }

      this.healthMap.set(key, health)
    }
  }

  /**
   * 标记代理成功
   */
  markSuccess(proxy: ProxyConfig, latency: number): void {
    const key = this.getProxyKey(proxy)
    const health = this.healthMap.get(key)

    if (health) {
      health.consecutiveFailures = 0
      health.isHealthy = true
      health.lastCheckAt = new Date()

      // 更新平均延迟（简单移动平均）
      health.averageLatency = health.averageLatency === 0
        ? latency
        : (health.averageLatency * 0.7 + latency * 0.3)

      this.healthMap.set(key, health)
    }
  }

  /**
   * 获取所有健康的代理
   */
  getHealthyProxies(): ProxyConfig[] {
    return Array.from(this.healthMap.values())
      .filter(h => h.isHealthy)
      .map(h => h.proxy)
  }

  /**
   * 获取代理健康状态
   */
  getHealth(): ProxyHealth[] {
    return Array.from(this.healthMap.values())
  }

  /**
   * 测试单个代理
   */
  private async checkProxyHealth(proxy: ProxyConfig): Promise<boolean> {
    const key = this.getProxyKey(proxy)
    const startTime = Date.now()

    try {
      // 构建代理 URL
      const proxyUrl = proxy.username && proxy.password
        ? `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
        : `${proxy.protocol}://${proxy.host}:${proxy.port}`

      // 使用代理访问测试 URL
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.healthCheckTimeout)

      const response = await fetch(this.config.testUrl, {
        signal: controller.signal,
        // @ts-expect-error proxy is not in standard fetch options
        proxy: proxyUrl,
      })

      clearTimeout(timeoutId)

      const latency = Date.now() - startTime

      if (response.ok) {
        this.markSuccess(proxy, latency)
        console.log(`[ProxyPool] ✓ Proxy ${key} healthy (${latency}ms)`)
        return true
      }
      else {
        this.markFailure(proxy)
        console.warn(`[ProxyPool] ⚠️ Proxy ${key} returned ${response.status}`)
        return false
      }
    }
    catch (e) {
      this.markFailure(proxy)
      console.error(`[ProxyPool] ❌ Proxy ${key} check failed:`, e)
      return false
    }
  }

  /**
   * 检查所有代理的健康状态
   */
  async checkAllProxies(): Promise<void> {
    console.log('[ProxyPool] 🔍 Running health check for all proxies...')

    const checks = this.proxies.map(proxy => this.checkProxyHealth(proxy))
    await Promise.all(checks)

    const healthyCount = this.getHealthyProxies().length
    console.log(`[ProxyPool] ✓ Health check complete: ${healthyCount}/${this.proxies.length} healthy`)
  }

  /**
   * 启动定期健康检查
   */
  startHealthCheck(): void {
    if (this.healthCheckTimer) {
      console.warn('[ProxyPool] ⚠️ Health check already running')
      return
    }

    console.log(`[ProxyPool] 🚀 Starting health check (interval: ${this.config.healthCheckInterval}ms)`)

    // 立即执行一次
    this.checkAllProxies()

    // 定期执行
    this.healthCheckTimer = setInterval(() => {
      this.checkAllProxies()
    }, this.config.healthCheckInterval)
  }

  /**
   * 停止定期健康检查
   */
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = undefined
      console.log('[ProxyPool] 🛑 Health check stopped')
    }
  }

  /**
   * 获取代理池统计信息
   */
  getStats() {
    const health = this.getHealth()
    const healthy = health.filter(h => h.isHealthy)
    const unhealthy = health.filter(h => !h.isHealthy)

    return {
      total: this.proxies.length,
      healthy: healthy.length,
      unhealthy: unhealthy.length,
      healthyPercentage: Math.round((healthy.length / this.proxies.length) * 100),
      avgLatency: healthy.reduce((sum, h) => sum + h.averageLatency, 0) / (healthy.length || 1),
    }
  }
}

/**
 * 从环境变量解析代理池配置
 */
export function parseProxyPoolConfig(): ProxyPoolConfig | null {
  const proxyList = process.env.PROXY_POOL

  if (!proxyList) {
    console.log('[ProxyPool] ℹ️ No proxy pool configured')
    return null
  }

  const proxies: ProxyConfig[] = proxyList.split(',').map((item) => {
    const [host, port] = item.trim().split(':')
    return {
      host,
      port: Number(port) || 8080,
      protocol: (process.env.PROXY_PROTOCOL as 'http' | 'https' | 'socks5') || 'http',
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    }
  })

  return {
    proxies,
    strategy: (process.env.PROXY_ROTATION_STRATEGY as RotationStrategy) || 'on-failure',
    healthCheckInterval: Number(process.env.PROXY_HEALTH_CHECK_INTERVAL) || 5 * 60 * 1000, // 5分钟
    healthCheckTimeout: Number(process.env.PROXY_HEALTH_CHECK_TIMEOUT) || 10000, // 10秒
    maxConsecutiveFailures: Number(process.env.PROXY_MAX_CONSECUTIVE_FAILURES) || 3,
    testUrl: process.env.PROXY_TEST_URL || 'https://www.google.com',
  }
}
