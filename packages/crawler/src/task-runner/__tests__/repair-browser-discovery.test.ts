import { beforeEach, describe, expect, it, vi } from 'vitest'
import { discoverRepairSourcesWithBrowser } from '../repair-browser-discovery'

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  close: vi.fn(),
  createPage: vi.fn(),
  goto: vi.fn(),
  content: vi.fn(),
  discover: vi.fn(),
}))
vi.mock('../../utils/browser', () => ({
  BrowserManager: class {
    launch = mocks.launch
    close = mocks.close
    createPage = mocks.createPage
  },
}))
vi.mock('../repair-source-discovery', () => ({ discoverRepairSources: mocks.discover }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.createPage.mockResolvedValue({ goto: mocks.goto, content: mocks.content })
  mocks.goto.mockResolvedValue({ ok: () => true, status: () => 200 })
  mocks.content.mockResolvedValue('<html></html>')
})

describe('repair browser lifecycle', () => {
  it('reuses one browser and page for search and detail and closes after readback', async () => {
    const result = { observedAt: 123, sources: [] }
    mocks.discover.mockImplementation(async ({ requestHtml }) => {
      await requestHtml('https://javdb.com/search?q=SONE-963')
      await requestHtml('https://javdb.com/v/Aq9p7w')
      expect(mocks.close).not.toHaveBeenCalled()
      return result
    })
    await expect(discoverRepairSourcesWithBrowser({ movieCode: 'SONE-963' })).resolves.toEqual(result)
    expect(mocks.launch).toHaveBeenCalledOnce()
    expect(mocks.createPage).toHaveBeenCalledOnce()
    expect(mocks.goto).toHaveBeenCalledTimes(2)
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('closes resources on navigation failure', async () => {
    mocks.goto.mockRejectedValue(new Error('timeout'))
    mocks.discover.mockImplementation(async ({ requestHtml }) => requestHtml('https://javdb.com/'))
    await expect(discoverRepairSourcesWithBrowser({ movieCode: 'SONE-963' })).rejects.toThrow('timeout')
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('rejects non-success responses before reading their HTML', async () => {
    mocks.goto.mockResolvedValue({ ok: () => false, status: () => 403 })
    mocks.discover.mockImplementation(async ({ requestHtml }) => requestHtml('https://javdb.com/'))
    await expect(discoverRepairSourcesWithBrowser({ movieCode: 'SONE-963' })).rejects.toThrow('repair_source_http_403')
    expect(mocks.content).not.toHaveBeenCalled()
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('cleans up when page creation fails', async () => {
    mocks.createPage.mockRejectedValue(new Error('page failed'))
    await expect(discoverRepairSourcesWithBrowser({ movieCode: 'SONE-963' })).rejects.toThrow('page failed')
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(mocks.discover).not.toHaveBeenCalled()
  })
})
