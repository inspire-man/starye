import type { RequestListener } from 'node:http'
import type { Socket } from 'node:net'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'

interface GatewayAuthProbeResult {
  readonly outcome: 'accepted' | 'timeout' | 'fetch_failed' | 'http_status_unaccepted' | 'redirect_invalid'
}

interface GatewayReadinessResult {
  readonly schema: 'starye-gateway-readiness-1'
  readonly healthy: boolean
  readonly robots: GatewayAuthProbeResult
  readonly auth: GatewayAuthProbeResult
  readonly authSlash: GatewayAuthProbeResult
}

interface GatewayReadinessModule {
  observeCanonicalGatewayAuth: (dependencies?: {
    readonly fetch?: typeof fetch
    readonly timeoutMs?: number
  }) => Promise<GatewayAuthProbeResult>
  probeCanonicalGatewayReadiness: (dependencies?: {
    readonly fetch?: typeof fetch
    readonly timeoutMs?: number
  }) => Promise<GatewayReadinessResult>
  runGatewayReadinessCli: (dependencies?: {
    readonly log?: (line: string) => void
    readonly probe?: () => Promise<GatewayReadinessResult>
  }) => Promise<0 | 1>
}

interface TestServer {
  readonly origin: string
  close: () => Promise<void>
}

async function loadGatewayReadiness(): Promise<GatewayReadinessModule> {
  return import(/* @vite-ignore */ new URL('../../../../../scripts/gateway-readiness.ts', import.meta.url).href) as Promise<GatewayReadinessModule>
}

async function createTestServer(handler: RequestListener): Promise<TestServer> {
  const server = createServer(handler)
  const sockets = new Set<Socket>()
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Ephemeral test server did not expose a TCP port.')
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: async () => {
      for (const socket of sockets) {
        socket.destroy()
      }
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve())
      })
    },
  }
}

function gatewayFetch(origin: string): typeof fetch {
  return (input, init) => {
    const canonical = input instanceof Request
      ? new URL(input.url)
      : input instanceof URL ? input : new URL(String(input))
    const target = new URL(`${canonical.pathname}${canonical.search}`, origin)
    return fetch(target, init)
  }
}

function acceptedResult(): GatewayReadinessResult {
  return {
    schema: 'starye-gateway-readiness-1',
    healthy: true,
    robots: { outcome: 'accepted' },
    auth: { outcome: 'accepted' },
    authSlash: { outcome: 'accepted' },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('canonical Gateway readiness', () => {
  it('rejects a listening socket that emits no response headers within the bounded deadline', async () => {
    const { observeCanonicalGatewayAuth } = await loadGatewayReadiness()
    const server = await createTestServer(() => {
      // Keep the socket open: the fetch must be cancelled by the probe deadline.
    })

    try {
      await expect(observeCanonicalGatewayAuth({
        fetch: gatewayFetch(server.origin),
        timeoutMs: 25,
      })).resolves.toEqual({ outcome: 'timeout' })
    }
    finally {
      await server.close()
    }
  })

  it('requires all three fixed canonical route contracts before readiness is healthy', async () => {
    const { probeCanonicalGatewayReadiness } = await loadGatewayReadiness()
    const server = await createTestServer((request, response) => {
      if (request.url === '/robots.txt') {
        response.writeHead(200).end('User-agent: *')
        return
      }
      if (request.url === '/auth') {
        response.writeHead(301, { location: 'http://localhost:8080/auth/' }).end()
        return
      }
      if (request.url === '/auth/') {
        response.writeHead(302, { location: '/auth/login' }).end()
        return
      }
      response.writeHead(404).end()
    })

    try {
      await expect(probeCanonicalGatewayReadiness({
        fetch: gatewayFetch(server.origin),
        timeoutMs: 100,
      })).resolves.toEqual(acceptedResult())
    }
    finally {
      await server.close()
    }
  })

  it.each([
    ['missing', undefined],
    ['external', 'https://example.invalid/auth/login'],
    ['direct port', 'http://localhost:3003/auth/login'],
  ])('classifies a %s auth redirect as closed redirect_invalid output', async (_name, location) => {
    const { observeCanonicalGatewayAuth } = await loadGatewayReadiness()
    const server = await createTestServer((_request, response) => {
      response.writeHead(302, location ? { location } : {}).end()
    })

    try {
      await expect(observeCanonicalGatewayAuth({
        fetch: gatewayFetch(server.origin),
        timeoutMs: 100,
      })).resolves.toEqual({ outcome: 'redirect_invalid' })
    }
    finally {
      await server.close()
    }
  })

  it('separates unacceptable status and non-timeout fetch failure without serializing details', async () => {
    const { observeCanonicalGatewayAuth } = await loadGatewayReadiness()
    const server = await createTestServer((_request, response) => {
      response.writeHead(503).end('unavailable')
    })

    try {
      await expect(observeCanonicalGatewayAuth({
        fetch: gatewayFetch(server.origin),
        timeoutMs: 100,
      })).resolves.toEqual({ outcome: 'http_status_unaccepted' })
    }
    finally {
      await server.close()
    }

    const result = await observeCanonicalGatewayAuth({
      fetch: async () => {
        throw new Error('sensitive upstream failure at http://localhost:3003 with token=secret')
      },
      timeoutMs: 100,
    })
    expect(result).toEqual({ outcome: 'fetch_failed' })
    expect(JSON.stringify(result)).not.toMatch(/sensitive|3003|secret/)
  })

  it('cancels an unconsumed body and clears the request timer after an accepted response', async () => {
    const { observeCanonicalGatewayAuth } = await loadGatewayReadiness()
    const cancel = vi.fn()
    const signals: AbortSignal[] = []
    vi.useFakeTimers()

    const result = await observeCanonicalGatewayAuth({
      fetch: async (_input, init) => {
        signals.push(init?.signal as AbortSignal)
        return new Response(new ReadableStream({ cancel }), { status: 200 })
      },
      timeoutMs: 25,
    })

    vi.advanceTimersByTime(25)
    expect(result).toEqual({ outcome: 'accepted' })
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(signals[0]?.aborted).toBe(false)
  })

  it('logs exactly one binary versioned JSON result without an alternate origin argument', async () => {
    const { runGatewayReadinessCli } = await loadGatewayReadiness()
    const lines: string[] = []

    await expect(runGatewayReadinessCli({
      log: line => lines.push(line),
      probe: async () => ({ ...acceptedResult(), healthy: false }),
    })).resolves.toBe(1)

    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0] ?? '')).toEqual({ ...acceptedResult(), healthy: false })
    expect(lines[0]).not.toContain('127.0.0.1')
    expect(runGatewayReadinessCli.length).toBeLessThanOrEqual(1)
  })
})
