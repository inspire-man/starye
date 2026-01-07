import type { AppEnv } from '../types'
import { Hono } from 'hono'

const comics = new Hono<AppEnv>()

// List Comics (For Search Indexing & Frontend)
comics.get('/', async (c) => {
  const db = c.get('db')
  const auth = c.get('auth')

  // Check Session
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  const isAdult = (session?.user as any)?.isAdult === true

  const results = await db.query.comics.findMany({
    columns: {
      title: true,
      slug: true,
      coverImage: true,
      author: true,
      description: true,
      isR18: true,
    },
    orderBy: (comics, { desc }) => [desc(comics.updatedAt)],
  })

  // Filter sensitive data
  const safeResults = results.map((comic) => {
    // If comic is R18 and user is NOT adult (or not logged in)
    if (comic.isR18 && !isAdult) {
      return {
        ...comic,
        coverImage: null, // Hide cover
      }
    }
    return comic
  })

  return c.json(safeResults)
})

export default comics
