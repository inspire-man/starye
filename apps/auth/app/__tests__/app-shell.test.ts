import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('auth app shell', () => {
  it('keeps NuxtLayout above Radix ConfigProvider so route meta remains injectable', async () => {
    const source = await readFile(new URL('../app.vue', import.meta.url), 'utf8')

    expect(source).toMatch(/<NuxtLayout>[\s\S]*<ConfigProvider[\s\S]*<NuxtPage[\s\S]*<\/ConfigProvider>[\s\S]*<\/NuxtLayout>/)
    expect(source).not.toMatch(/<ConfigProvider[\s\S]*<NuxtLayout>/)
  })
})
