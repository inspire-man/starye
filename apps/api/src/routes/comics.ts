import type { AppEnv } from '../types'
import { Hono } from 'hono'

const comics = new Hono<AppEnv>()

// List Comics (For Search Indexing & Frontend)
comics.get('/', async (c) => {
  const db = c.get('db')
  const results = await db.query.comics.findMany({
    columns: {
      title: true,
      slug: true,
      coverImage: true,
      author: true,
      description: true,
    },
    orderBy: (comics, { desc }) => [desc(comics.updatedAt)],
  })
  return c.json(results)
})

export default comics
