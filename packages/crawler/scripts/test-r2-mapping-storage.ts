import process from 'node:process'

if (process.argv[1]?.endsWith('test-r2-mapping-storage.ts')) {
  throw new Error('test-r2-mapping-storage is blocked: it cannot select a target from ambient configuration.')
}
