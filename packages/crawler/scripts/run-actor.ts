import process from 'node:process'

if (process.argv[1]?.endsWith('run-actor.ts')) {
  throw new Error('run-actor must run through crawler-actor with an explicit --target.')
}
