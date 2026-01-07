import type { AppEnv, SessionUser } from '../types'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

const comics = new Hono<AppEnv>()

// Helper to check adult status
async function checkIsAdult(c: any) {
  const auth = c.get('auth')
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  // Safe cast since we know our schema
  const user = session?.user as SessionUser | undefined
  return user?.isAdult === true
}

// 1. List Comics (For Search Indexing & Frontend)
comics.get('/', async (c) => {
  const db = c.get('db')
  const isAdult = await checkIsAdult(c)

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

  const safeResults = results.map((comic) => {
    if (comic.isR18 && !isAdult) {
      return { ...comic, coverImage: null }
    }
    return comic
  })

  return c.json(safeResults)
})

// 2. Comic Details (With Chapters)
comics.get('/:slug', async (c) => {
  const db = c.get('db')
  const slug = c.req.param('slug')
  const isAdult = await checkIsAdult(c)

  const comic = await db.query.comics.findFirst({
    where: (comics, { eq }) => eq(comics.slug, slug),
    with: {
      chapters: {
        columns: {
          title: true,
          slug: true,
          chapterNumber: true,
          publishedAt: true,
        },
        orderBy: (chapters, { asc }) => [asc(chapters.sortOrder)],
      },
    },
  })

  if (!comic) {
    throw new HTTPException(404, { message: 'Comic not found' })
  }

  // R18 Protection: Hide cover if not authorized
  if (comic.isR18 && !isAdult) {
    return c.json({
      ...comic,
      coverImage: null,
    })
  }

  return c.json(comic)
})

// 3. Read Chapter (Pages)
comics.get('/:slug/:chapterSlug', async (c) => {
  const db = c.get('db')
  const { slug, chapterSlug } = c.req.param()
  const isAdult = await checkIsAdult(c)

  // 1. Get Comic Info for R18 Check
  const comic = await db.query.comics.findFirst({
    where: (comics, { eq }) => eq(comics.slug, slug),
    columns: { id: true, isR18: true, title: true },
  })

  if (!comic) {
    throw new HTTPException(404, { message: 'Comic not found' })
  }

  // STRICT SECURITY CHECK: R18 Content
  if (comic.isR18 && !isAdult) {
    throw new HTTPException(403, {
      message: 'Age verification required to access this content.',
    })
  }

  // 2. Get Chapter & Pages
  const chapter = await db.query.chapters.findFirst({
    where: (chapters, { eq, and }) => and(
      eq(chapters.comicId, comic.id),
      eq(chapters.slug, chapterSlug),
    ),
    with: {
      pages: {
        orderBy: (pages, { asc }) => [asc(pages.pageNumber)],
      },
      comic: {
        columns: {
          slug: true,
          title: true,
        },
      },
    },
  })

  if (!chapter) {
    throw new HTTPException(404, { message: 'Chapter not found' })
  }

  return c.json(chapter)
})

export default comics
