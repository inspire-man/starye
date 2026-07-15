import process from 'node:process'

if (process.argv[1]?.endsWith('test-movie-sync.ts')) {
  throw new Error('test-movie-sync is blocked: it cannot select a target from ambient configuration.')
}
