import process from 'node:process'

if (process.argv[1]?.endsWith('apply-index-migration.ts')) {
  throw new Error('apply-index-migration has no validated local SQLite path and is blocked.')
}
