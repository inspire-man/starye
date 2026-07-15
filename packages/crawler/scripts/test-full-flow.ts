import process from 'node:process'

if (process.argv[1]?.endsWith('test-full-flow.ts')) {
  throw new Error('test-full-flow is blocked: it cannot select a target from ambient configuration.')
}
