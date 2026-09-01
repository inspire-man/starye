import type { Database } from '@starye/db'
import { quantAiConfigs } from '@starye/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { QUANT_AI_GENERATION_TIMEOUT_DEFAULT_MS, QUANT_AI_GENERATION_TIMEOUT_MAX_MS } from './ai-timeout'
import { QuantError } from './errors'

export const QUANT_AI_PROVIDERS = ['openai_compatible', 'deepseek', 'qwen', 'gemini', 'ollama'] as const
export type QuantAiProvider = typeof QUANT_AI_PROVIDERS[number]
export const QUANT_AI_RESPONSE_MODES = ['stream', 'json'] as const
export type QuantAiResponseMode = typeof QUANT_AI_RESPONSE_MODES[number]

export interface QuantAiConfigView {
  readonly id: string
  readonly provider: QuantAiProvider
  readonly model: string
  readonly baseUrl: string | null
  readonly responseMode: QuantAiResponseMode
  readonly generationTimeoutMs: number
  readonly hasApiKey: boolean
  readonly apiKeyHint: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface QuantAiConfigInput {
  readonly userId: string
  readonly provider: string
  readonly model: string
  readonly baseUrl?: string | null
  readonly responseMode?: string
  readonly generationTimeoutMs?: number
  readonly apiKey?: string
  readonly clearApiKey?: boolean
}

export interface QuantDecryptedAiConfig {
  readonly id: string
  readonly provider: QuantAiProvider
  readonly model: string
  readonly baseUrl: string | null
  readonly responseMode?: QuantAiResponseMode
  readonly generationTimeoutMs?: number
  readonly apiKey: string | null
}

function normalizedUserId(value: string): string {
  const userId = value.trim()
  if (!userId)
    throw new QuantError('QUANT_AI_CONFIGURATION', 'Authenticated user id is required', 401)
  return userId
}

function normalizedProvider(value: string): QuantAiProvider {
  const provider = value.trim().toLowerCase()
  if (!(QUANT_AI_PROVIDERS as readonly string[]).includes(provider))
    throw new QuantError('QUANT_AI_CONFIGURATION', 'AI provider is not supported', 400)
  return provider as QuantAiProvider
}

function normalizedModel(value: string): string {
  const model = value.trim()
  if (!model || model.length > 128)
    throw new QuantError('QUANT_AI_CONFIGURATION', 'AI model must be between 1 and 128 characters', 400)
  return model
}

function normalizedBaseUrl(value: string | null | undefined): string | null {
  const baseUrl = value?.trim() || ''
  if (!baseUrl)
    return null
  try {
    const parsed = new URL(baseUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      throw new Error('protocol')
  }
  catch {
    throw new QuantError('QUANT_AI_CONFIGURATION', 'AI base URL must be an HTTP or HTTPS URL', 400)
  }
  if (baseUrl.length > 2048)
    throw new QuantError('QUANT_AI_CONFIGURATION', 'AI base URL is too long', 400)
  return baseUrl
}

function normalizedResponseMode(value: string | undefined): QuantAiResponseMode {
  const mode = value?.trim().toLowerCase() || 'stream'
  if (!(QUANT_AI_RESPONSE_MODES as readonly string[]).includes(mode))
    throw new QuantError('QUANT_AI_CONFIGURATION', 'AI response mode is not supported', 400)
  return mode as QuantAiResponseMode
}

function normalizedGenerationTimeout(value: number | undefined): number {
  const timeoutMs = value ?? QUANT_AI_GENERATION_TIMEOUT_DEFAULT_MS
  if (!Number.isFinite(timeoutMs) || timeoutMs < QUANT_AI_GENERATION_TIMEOUT_DEFAULT_MS || timeoutMs > QUANT_AI_GENERATION_TIMEOUT_MAX_MS)
    throw new QuantError('QUANT_AI_CONFIGURATION', 'AI generation timeout must be between five and ten minutes', 400)
  return Math.floor(timeoutMs)
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

async function deriveEncryptionKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

function requireEncryptionSecret(value: string | undefined): string {
  const secret = value?.trim() || ''
  if (!secret)
    throw new QuantError('QUANT_AI_CONFIGURATION', 'QUANT_AI_ENCRYPTION_KEY is not configured', 503)
  return secret
}

async function encryptApiKey(apiKey: string, encryptionSecret: string | undefined): Promise<string> {
  const key = await deriveEncryptionKey(requireEncryptionSecret(encryptionSecret))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(apiKey),
  )
  return `v1:${encodeBase64(iv)}:${encodeBase64(new Uint8Array(ciphertext))}`
}

async function decryptApiKey(value: string, encryptionSecret: string | undefined): Promise<string> {
  const [version, encodedIv, encodedCiphertext] = value.split(':')
  if (version !== 'v1' || !encodedIv || !encodedCiphertext)
    throw new QuantError('QUANT_AI_CONFIGURATION', 'Stored AI key format is invalid', 503)
  const key = await deriveEncryptionKey(requireEncryptionSecret(encryptionSecret))
  try {
    const iv = toArrayBuffer(decodeBase64(encodedIv))
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      toArrayBuffer(decodeBase64(encodedCiphertext)),
    )
    return new TextDecoder().decode(plaintext)
  }
  catch {
    throw new QuantError('QUANT_AI_CONFIGURATION', 'Stored AI key cannot be decrypted', 503)
  }
}

function toView(config: typeof quantAiConfigs.$inferSelect): QuantAiConfigView {
  return {
    id: config.id,
    provider: config.provider as QuantAiProvider,
    model: config.model,
    baseUrl: config.baseUrl,
    responseMode: config.responseMode as QuantAiResponseMode,
    generationTimeoutMs: config.generationTimeoutMs,
    hasApiKey: Boolean(config.encryptedApiKey),
    apiKeyHint: config.apiKeyHint,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  }
}

export async function getQuantAiConfig(db: Database, userId: string): Promise<QuantAiConfigView | null> {
  const config = await db.select().from(quantAiConfigs).where(eq(quantAiConfigs.userId, normalizedUserId(userId))).get()
  return config ? toView(config) : null
}

export async function saveQuantAiConfig(
  db: Database,
  input: QuantAiConfigInput,
  encryptionSecret?: string,
): Promise<QuantAiConfigView> {
  const userId = normalizedUserId(input.userId)
  const provider = normalizedProvider(input.provider)
  const model = normalizedModel(input.model)
  const baseUrl = normalizedBaseUrl(input.baseUrl)
  if (input.apiKey !== undefined && input.apiKey.length > 1024)
    throw new QuantError('QUANT_AI_CONFIGURATION', 'AI API key is too long', 400)

  const existing = await db.select().from(quantAiConfigs).where(eq(quantAiConfigs.userId, userId)).get()
  const responseMode = normalizedResponseMode(input.responseMode ?? existing?.responseMode)
  const generationTimeoutMs = normalizedGenerationTimeout(input.generationTimeoutMs ?? existing?.generationTimeoutMs)
  let encryptedApiKey = existing?.encryptedApiKey ?? null
  let apiKeyHint = existing?.apiKeyHint ?? null
  if (input.clearApiKey) {
    encryptedApiKey = null
    apiKeyHint = null
  }
  if (input.apiKey !== undefined && input.apiKey.trim()) {
    encryptedApiKey = await encryptApiKey(input.apiKey.trim(), encryptionSecret)
    apiKeyHint = input.apiKey.trim().slice(-4)
  }

  const now = new Date()
  if (existing) {
    await db.update(quantAiConfigs).set({
      provider,
      model,
      baseUrl,
      responseMode,
      generationTimeoutMs,
      encryptedApiKey,
      apiKeyHint,
      updatedAt: now,
    }).where(eq(quantAiConfigs.id, existing.id))
  }
  else {
    await db.insert(quantAiConfigs).values({
      id: nanoid(),
      userId,
      provider,
      model,
      baseUrl,
      responseMode,
      generationTimeoutMs,
      encryptedApiKey,
      apiKeyHint,
      createdAt: now,
      updatedAt: now,
    })
  }

  const persisted = await db.select().from(quantAiConfigs).where(eq(quantAiConfigs.userId, userId)).get()
  if (!persisted)
    throw new QuantError('QUANT_AI_CONFIGURATION', 'AI configuration readback failed', 500)
  return toView(persisted)
}

export async function deleteQuantAiConfig(db: Database, userId: string): Promise<boolean> {
  const result = await db.delete(quantAiConfigs).where(eq(quantAiConfigs.userId, normalizedUserId(userId))).run()
  if (!result || typeof result !== 'object')
    return false
  const record = result as {
    readonly meta?: { readonly changes?: unknown }
    readonly rowsAffected?: unknown
  }
  const changes = record.meta?.changes ?? record.rowsAffected
  return typeof changes === 'number' && changes > 0
}

export async function getDecryptedQuantAiConfig(
  db: Database,
  userId: string,
  encryptionSecret?: string,
): Promise<QuantDecryptedAiConfig | null> {
  const config = await db.select().from(quantAiConfigs).where(eq(quantAiConfigs.userId, normalizedUserId(userId))).get()
  if (!config)
    return null
  return {
    id: config.id,
    provider: config.provider as QuantAiProvider,
    model: config.model,
    baseUrl: config.baseUrl,
    responseMode: config.responseMode as QuantAiResponseMode,
    generationTimeoutMs: config.generationTimeoutMs,
    apiKey: config.encryptedApiKey ? await decryptApiKey(config.encryptedApiKey, encryptionSecret) : null,
  }
}
