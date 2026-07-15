import process from 'node:process'

if (process.argv[1]?.endsWith('configure-user-permissions.ts')) {
  throw new Error('configure-user-permissions is blocked: no selected-target registry entry exists.')
}
