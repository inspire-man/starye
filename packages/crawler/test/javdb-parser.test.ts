import fs from 'node:fs'
import path from 'node:path'
import { Window } from 'happy-dom'
import { describe, expect, it } from 'vitest'
import { parseMovieInfo, parseMovieList } from '../src/strategies/javdb-parser'

describe('javDB Parser', () => {
  const listHtml = fs.readFileSync(path.join(__dirname, 'fixtures/javdb-list.html'), 'utf-8')
  const detailHtml = fs.readFileSync(path.join(__dirname, 'fixtures/javdb-detail.html'), 'utf-8')

  it('should parse movie list correctly', () => {
    const window = new Window()
    const document = window.document
    document.write(listHtml)

    const result = parseMovieList(document)
    expect(result.movies.length).toBeGreaterThan(0)
    expect(result.movies[0]).toContain('https://javdb457.com/v/')
    expect(result.next).toBe('https://javdb457.com/?page=2')
  })

  it('should parse movie info correctly', () => {
    const window = new Window()
    const document = window.document
    document.write(detailHtml)

    const url = 'https://javdb457.com/v/Ywmd3e'
    const info = parseMovieInfo(document, url)

    expect(info.title).toContain('アラサー童貞仲間だった友達がまさかの美人彼女GET')
    expect(info.code).toBe('DVAJ-723')
    expect(info.coverImage).toBe('https://c0.jdbstatic.com/covers/yw/Ywmd3e.jpg')
    expect(info.releaseDate).toBeGreaterThan(0)
    expect(info.duration).toBe(141)
    expect(info.publisher).toBe('アリスJAPAN')
    expect(info.actors).toContain('虹村ゆみ')
    expect(info.genres).toContain('拘束')
    expect(info.players.length).toBeGreaterThan(0)
    expect(info.players[0].sourceUrl).toContain('magnet:?xt=urn:btih:')
  })
})
