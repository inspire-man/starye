import { createHmac, randomUUID } from 'node:crypto'

export function signRunnerBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('base64url')
}

export function createRunnerEventId(): string {
  return randomUUID()
}
