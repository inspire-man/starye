import type { PreparedDbRuntime } from './migrate-movies-metadata'
import process from 'node:process'

export async function cleanupInvalidCovers(runtime: PreparedDbRuntime): Promise<void> {
  if (!runtime.targetId) {
    throw new Error('cleanupInvalidCovers requires a prepared DB runtime.')
  }
  throw new Error('cleanupInvalidCovers requires the selected-target D1 executor.')
}

if (process.argv[1]?.endsWith('cleanup-invalid-covers.ts')) {
  throw new Error('cleanup-invalid-covers must run through d1-cleanup-invalid-covers with an explicit --target.')
}
