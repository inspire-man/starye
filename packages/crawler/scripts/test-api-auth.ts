import process from 'node:process'

if (process.argv[1]?.endsWith('test-api-auth.ts')) {
  throw new Error('test-api-auth is blocked: use the selected-target diagnostic entry instead.')
}
