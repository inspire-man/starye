import { Miniflare } from '../../node_modules/.pnpm/miniflare@4.20260508.0/node_modules/miniflare/dist/src/index.js'

const endpoint = 'https://github.com/login/oauth/access_token'
const timeoutMs = 30_000

const makeBody = () => new URLSearchParams({
  grant_type: 'authorization_code',
  client_id: 'diagnostic',
  client_secret: 'diagnostic',
  code: 'diagnostic',
  redirect_uri: 'http://localhost:8080/api/auth/callback/github',
})

const requestOptions = () => ({
  method: 'POST',
  headers: {
    accept: 'application/json',
    'content-type': 'application/x-www-form-urlencoded',
  },
  body: makeBody(),
  signal: AbortSignal.timeout(timeoutMs),
})

function classifyError(error) {
  return {
    name: error instanceof Error ? error.name : typeof error,
    messageCategory: error instanceof Error && /timeout/i.test(error.message)
      ? 'timeout'
      : error instanceof Error && /fetch|network|connect|socket|tls/i.test(error.message)
        ? 'network'
        : 'other',
    causeCode: error instanceof Error && error.cause && typeof error.cause === 'object' && 'code' in error.cause
      ? String(error.cause.code)
      : null,
  }
}

async function runHostProbe() {
  const startedAt = Date.now()
  try {
    const runtimeFetch = globalThis.fetch
    const response = await runtimeFetch(endpoint, requestOptions())
    const data = await response.json().catch(() => null)
    return {
      runtime: 'node',
      ok: true,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      oauthError: data && typeof data.error === 'string' ? data.error : null,
    }
  }
  catch (error) {
    return {
      runtime: 'node',
      ok: false,
      elapsedMs: Date.now() - startedAt,
      ...classifyError(error),
    }
  }
}

const workerScript = `
export default {
  async fetch() {
    const startedAt = Date.now();
    try {
      const runtimeFetch = globalThis.fetch;
      const response = await runtimeFetch(${JSON.stringify(endpoint)}, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: 'diagnostic',
          client_secret: 'diagnostic',
          code: 'diagnostic',
          redirect_uri: 'http://localhost:8080/api/auth/callback/github',
        }),
        signal: AbortSignal.timeout(${timeoutMs}),
      });
      const data = await response.json().catch(() => null);
      return Response.json({
        runtime: 'workerd',
        ok: true,
        status: response.status,
        elapsedMs: Date.now() - startedAt,
        oauthError: data && typeof data.error === 'string' ? data.error : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      return Response.json({
        runtime: 'workerd',
        ok: false,
        elapsedMs: Date.now() - startedAt,
        name: error instanceof Error ? error.name : typeof error,
        messageCategory: /timeout/i.test(message)
          ? 'timeout'
          : /fetch|network|connect|socket|tls/i.test(message)
            ? 'network'
            : 'other',
        causeCode: error instanceof Error && error.cause && typeof error.cause === 'object' && 'code' in error.cause
          ? String(error.cause.code)
          : null,
      });
    }
  },
};
`

const hostResult = await runHostProbe()
const miniflare = new Miniflare({
  modules: true,
  script: workerScript,
  compatibilityDate: '2024-04-01',
  compatibilityFlags: ['nodejs_compat'],
})

try {
  const response = await miniflare.dispatchFetch('http://localhost:8080/diagnostic')
  const workerdResult = await response.json()
  console.log(JSON.stringify({ hostResult, workerdResult }, null, 2))
}
finally {
  await miniflare.dispose()
}
