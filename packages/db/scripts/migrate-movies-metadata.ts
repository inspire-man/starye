import process from 'node:process'

export interface PreparedDbRuntime {
  readonly targetId: string
  readonly runId: string
  readonly apiConfigPath: string
  readonly gatewayConfigPath: string
}

export async function migrateMoviesMetadata(runtime: PreparedDbRuntime): Promise<void> {
  if (!runtime.targetId || !runtime.runId || !runtime.apiConfigPath || !runtime.gatewayConfigPath) {
    throw new Error('migrateMoviesMetadata requires a complete prepared DB runtime.')
  }
  throw new Error('migrateMoviesMetadata requires the selected-target D1 executor.')
}

if (process.argv[1]?.endsWith('migrate-movies-metadata.ts')) {
  throw new Error('migrate-movies-metadata must run through d1-migrate-movies-metadata with an explicit --target.')
}
