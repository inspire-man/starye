import process from 'node:process'

if (process.argv[1]?.endsWith('sync-actors-publishers.ts')) {
  throw new Error('sync-actors-publishers has no validated local SQLite path and is blocked.')
}
