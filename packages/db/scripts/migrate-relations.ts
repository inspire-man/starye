import process from 'node:process'

if (process.argv[1]?.endsWith('migrate-relations.ts')) {
  throw new Error('migrate-relations has no validated local SQLite path and is blocked.')
}
