import type { RepairDiscoveryOptions } from './repair-source-discovery'
import type { RepairSourceObservationInput } from './runner-client'
import { BrowserManager } from '../utils/browser'
import { discoverRepairSources } from './repair-source-discovery'

export async function discoverRepairSourcesWithBrowser(
  options: Omit<RepairDiscoveryOptions, 'requestHtml'>,
): Promise<RepairSourceObservationInput> {
  const manager = new BrowserManager()
  try {
    await manager.launch()
    const page = await manager.createPage()
    return await discoverRepairSources({
      ...options,
      requestHtml: async (url) => {
        const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90_000 })
        if (!response || !response.ok())
          throw new Error(`repair_source_http_${response?.status() ?? 0}`)
        return page.content()
      },
    })
  }
  finally {
    await manager.close()
  }
}
