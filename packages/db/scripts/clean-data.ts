import process from 'node:process'

if (process.argv[1]?.endsWith('clean-data.ts')) {
  throw new Error('clean-data has no validated local SQLite path and is blocked.')
}
