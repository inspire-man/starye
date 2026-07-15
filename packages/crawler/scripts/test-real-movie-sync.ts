import process from 'node:process'

if (process.argv[1]?.endsWith('test-real-movie-sync.ts')) {
  throw new Error('test-real-movie-sync is blocked: it cannot select a target from ambient configuration.')
}
