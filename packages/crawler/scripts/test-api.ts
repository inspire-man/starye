import process from 'node:process'

if (process.argv[1]?.endsWith('test-api.ts')) {
  throw new Error('test-api is blocked: use the selected-target diagnostic entry instead.')
}
