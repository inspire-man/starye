export interface RunnerEventSigningKey {
  readonly id: string
  readonly secret: string
  readonly validUntil?: number
}

export interface RunnerEventSigningKeys {
  readonly current: RunnerEventSigningKey
  readonly previous?: RunnerEventSigningKey
}

export function base64UrlEncode(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value)
  let encoded = ''
  for (const byte of bytes) encoded += String.fromCharCode(byte)
  return btoa(encoded).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function base64UrlDecode(value: string): ArrayBuffer | undefined {
  if (!/^[\w-]+$/u.test(value))
    return undefined
  try {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes.buffer
  }
  catch {
    return undefined
  }
}

function selectKey(keys: RunnerEventSigningKeys, keyId: string, now: number): RunnerEventSigningKey | undefined {
  if (keyId === keys.current.id)
    return keys.current
  if (keys.previous && keyId === keys.previous.id && keys.previous.validUntil !== undefined && now < keys.previous.validUntil) {
    return keys.previous
  }
  return undefined
}

function toArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer)
    return value
  const copy = new Uint8Array(value.byteLength)
  copy.set(value)
  return copy.buffer
}

export async function verifyRunnerEventSignature(input: {
  readonly body: ArrayBuffer | Uint8Array
  readonly keyId: string
  readonly keys: RunnerEventSigningKeys
  readonly now: number
  readonly signature: string
}): Promise<{ readonly keyId?: string, readonly valid: boolean }> {
  const keyConfig = selectKey(input.keys, input.keyId, input.now)
  const signature = base64UrlDecode(input.signature)
  if (!keyConfig || !signature)
    return { valid: false }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyConfig.secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['verify'],
  )
  const valid = await crypto.subtle.verify('HMAC', key, signature, toArrayBuffer(input.body))
  return valid ? { keyId: keyConfig.id, valid: true } : { valid: false }
}
