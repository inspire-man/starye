import process from 'node:process'

if (process.argv[1]?.endsWith('test-single-movie.ts')) {
  throw new Error('test-single-movie is blocked: it cannot select a target from ambient configuration.')
}
