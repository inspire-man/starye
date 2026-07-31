const GITHUB_APP_JWT_BACKDATE_SECONDS = 60
const GITHUB_APP_JWT_DEFAULT_LIFETIME_SECONDS = 9 * 60
const GITHUB_APP_JWT_MAX_LIFETIME_SECONDS = 10 * 60

export type GitHubAppJwtFailureCode
  = | 'github_app_jwt_app_id_invalid'
    | 'github_app_jwt_expiration_invalid'
    | 'github_app_jwt_private_key_invalid'
    | 'github_app_jwt_signing_failed'

export type GitHubAppJwtResult
  = | { readonly ok: true, readonly value: string }
    | { readonly code: GitHubAppJwtFailureCode, readonly ok: false }

function arrayBufferFromBytes(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength)
  copy.set(value)
  return copy.buffer
}

function base64UrlEncode(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value)
  let encoded = ''
  for (const byte of bytes)
    encoded += String.fromCharCode(byte)

  return btoa(encoded).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function decodePkcs8PrivateKey(value: string): ArrayBuffer | undefined {
  const header = '-----BEGIN PRIVATE KEY-----'
  const footer = '-----END PRIVATE KEY-----'
  const trimmed = value.trim()
  if (!trimmed.startsWith(header) || !trimmed.endsWith(footer))
    return undefined

  const encoded = trimmed.slice(header.length, -footer.length).replaceAll(/\s+/gu, '')
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded))
    return undefined

  try {
    const binary = atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1)
      bytes[index] = binary.charCodeAt(index)

    return arrayBufferFromBytes(bytes)
  }
  catch {
    return undefined
  }
}

function isValidAppId(value: string): boolean {
  return /^[1-9]\d*$/u.test(value)
}

function isValidNow(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

/** Creates the request-scoped RS256 App bearer used solely to mint an installation token. */
export async function createGitHubAppJwt(input: {
  readonly appId: string
  readonly expiresInSeconds?: number
  readonly now?: number
  readonly privateKeyPem: string
}): Promise<GitHubAppJwtResult> {
  const now = input.now ?? Math.floor(Date.now() / 1000)
  const expiresInSeconds = input.expiresInSeconds ?? GITHUB_APP_JWT_DEFAULT_LIFETIME_SECONDS
  if (!isValidAppId(input.appId))
    return { code: 'github_app_jwt_app_id_invalid', ok: false }
  if (!isValidNow(now) || !Number.isSafeInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > GITHUB_APP_JWT_MAX_LIFETIME_SECONDS) {
    return { code: 'github_app_jwt_expiration_invalid', ok: false }
  }

  const keyData = decodePkcs8PrivateKey(input.privateKeyPem)
  if (!keyData)
    return { code: 'github_app_jwt_private_key_invalid', ok: false }

  let signingKey: CryptoKey
  try {
    signingKey = await crypto.subtle.importKey(
      'pkcs8',
      keyData,
      { hash: 'SHA-256', name: 'RSASSA-PKCS1-v1_5' },
      false,
      ['sign'],
    )
  }
  catch {
    return { code: 'github_app_jwt_private_key_invalid', ok: false }
  }

  try {
    const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).buffer)
    const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
      exp: now + expiresInSeconds,
      iat: now - GITHUB_APP_JWT_BACKDATE_SECONDS,
      iss: input.appId,
    })).buffer)
    const unsignedToken = `${header}.${payload}`
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      signingKey,
      new TextEncoder().encode(unsignedToken),
    )
    return { ok: true, value: `${unsignedToken}.${base64UrlEncode(signature)}` }
  }
  catch {
    return { code: 'github_app_jwt_signing_failed', ok: false }
  }
}
