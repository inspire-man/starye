import process from 'node:process'

if (process.argv[1]?.endsWith('rollback-migration.ts')) {
  throw new Error('rollback-migration has no validated local SQLite path and is blocked.')
}
