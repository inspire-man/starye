import process from 'node:process'

if (process.argv[1]?.endsWith('migrate-actors-publishers.ts')) {
  throw new Error('migrate-actors-publishers has no validated local SQLite path and is blocked.')
}
