import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  vue: true,
  ignores: [
    '**/dist',
    '**/node_modules',
    '**/.output',
    '**/.nuxt',
    '**/.wrangler',
  ],
  rules: {
    'e18e/prefer-static-regex': 'off',
  },
})
