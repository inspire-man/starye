import process from 'node:process'
import { Window } from 'happy-dom'
import { parseJavDBMovieDetail, parseJavDBMovieImageSearch } from '../src/strategies/javdb-parser'
import { BrowserManager } from '../src/utils/browser'

const code = process.env.MOVIE_CODE?.trim().toUpperCase()
const apiUrl = process.env.ACTIONS_CALLBACK_API_BASE_URL?.replace(/\/$/u, '')
const crawlerSecret = process.env.CRAWLER_SECRET
if (!code || !apiUrl || !crawlerSecret)
  throw new Error('movie import environment is incomplete')

const manager = new BrowserManager()
try {
  await manager.launch()
  const page = await manager.createPage()
  const searchUrl = `https://javdb.com/search?q=${encodeURIComponent(code)}`
  await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 90_000 })
  const searchWindow = new Window({ url: searchUrl })
  searchWindow.document.write(await page.content())
  const search = parseJavDBMovieImageSearch(searchWindow.document as unknown as Document, searchUrl, code)
  searchWindow.close()
  if (!search)
    throw new Error(`movie code not found: ${code}`)
  await page.goto(search.detailUrl, { waitUntil: 'networkidle2', timeout: 90_000 })
  const detailWindow = new Window({ url: search.detailUrl })
  detailWindow.document.write(await page.content())
  const movie = parseJavDBMovieDetail(detailWindow.document as unknown as Document, search.detailUrl)
  detailWindow.close()
  if (!movie || movie.code.replace(/\s+/gu, '').toUpperCase() !== code)
    throw new Error(`movie identity mismatch: ${code}`)
  const response = await fetch(`${apiUrl}/api/admin/sync/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-service-token': crawlerSecret },
    body: JSON.stringify({ type: 'movie', data: movie }),
  })
  if (!response.ok)
    throw new Error(`movie sync failed: ${response.status}`)
  console.warn(JSON.stringify({ code, players: movie.players?.length ?? 0, synced: true }))
}
finally {
  await manager.close()
}
