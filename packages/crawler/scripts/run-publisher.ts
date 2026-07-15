import process from 'node:process'

if (process.argv[1]?.endsWith('run-publisher.ts')) {
  throw new Error('run-publisher must run through crawler-publisher with an explicit --target.')
}
