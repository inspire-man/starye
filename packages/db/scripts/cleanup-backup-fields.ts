import type { PreparedDbRuntime } from './migrate-movies-metadata'
import process from 'node:process'

export type BackupCleanupMode = 'preview' | 'execute'

export async function cleanupBackupFields(runtime: PreparedDbRuntime, mode: BackupCleanupMode): Promise<void> {
  if (!runtime.targetId || (mode !== 'preview' && mode !== 'execute')) {
    throw new Error('cleanupBackupFields requires a prepared runtime and a closed mode.')
  }
  throw new Error('cleanupBackupFields requires the selected-target D1 executor.')
}

if (process.argv[1]?.endsWith('cleanup-backup-fields.ts')) {
  throw new Error('cleanup-backup-fields must run through a d1-cleanup-backup registry entry.')
}
