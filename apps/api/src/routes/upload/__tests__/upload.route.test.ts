import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadRoutes } from '../index'

function createDb() {
  const values = vi.fn().mockResolvedValue(undefined)
  const insert = vi.fn(() => ({ values }))

  return {
    db: { insert } as any,
    insert,
    values,
  }
}

function createBucket() {
  return {
    put: vi.fn().mockResolvedValue(undefined),
  }
}

function createApp(db: any) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    await next()
  })
  app.route('/upload', uploadRoutes)
  return app
}

async function sendUploadRequest(
  app: Hono<AppEnv>,
  env: AppEnv['Bindings'],
  options: {
    filename?: string
    mimeType?: string
    purpose?: string
  } = {},
) {
  const formData = new FormData()
  formData.append(
    'file',
    new File(['image-bytes'], options.filename ?? 'asset.png', {
      type: options.mimeType ?? 'image/png',
    }),
  )

  if (options.purpose !== undefined) {
    formData.append('purpose', options.purpose)
  }

  return app.fetch(new Request('http://localhost/upload', {
    method: 'POST',
    headers: {
      'x-service-token': env.CRAWLER_SECRET,
    },
    body: formData,
  }), env)
}

describe('uploadRoutes purpose contract', () => {
  let bucket: ReturnType<typeof createBucket>
  let dbState: ReturnType<typeof createDb>
  let app: Hono<AppEnv>
  let env: AppEnv['Bindings']

  beforeEach(() => {
    bucket = createBucket()
    dbState = createDb()
    app = createApp(dbState.db)
    env = {
      BUCKET: bucket as any,
      R2_PUBLIC_URL: 'https://cdn.example.com',
      CRAWLER_SECRET: 'upload-secret',
    } as AppEnv['Bindings']
  })

  it('缺少 purpose 时返回 400', async () => {
    const res = await sendUploadRequest(app, env)

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: 'Upload purpose is required',
    })
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it('未知 purpose 时返回 400', async () => {
    const res = await sendUploadRequest(app, env, { purpose: 'poster' })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: 'Unsupported upload purpose: poster',
    })
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it('显式 chapter-page intent 会被拒绝', async () => {
    const res = await sendUploadRequest(app, env, { purpose: 'comic_chapter_page' })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: 'comic_chapter_page uploads are forbidden; chapter pages must stay on source URLs',
    })
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it('cover 会写入 covers/manual/ 前缀', async () => {
    const res = await sendUploadRequest(app, env, { purpose: 'cover', filename: 'cover.png' })

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.key).toMatch(/^covers\/manual\/\d+-[\w-]+\.png$/)
    expect(json.url).toBe(`https://cdn.example.com/${json.key}`)
    expect(bucket.put).toHaveBeenCalledTimes(1)
    expect(bucket.put.mock.calls[0][0]).toBe(json.key)
    expect(dbState.insert).toHaveBeenCalledTimes(1)
  })

  it('blog_inline 会写入 manual-assets/blog-inline/ 前缀', async () => {
    const res = await sendUploadRequest(app, env, { purpose: 'blog_inline', filename: 'inline.webp', mimeType: 'image/webp' })

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.key).toMatch(/^manual-assets\/blog-inline\/\d+-[\w-]+\.webp$/)
    expect(json.url).toBe(`https://cdn.example.com/${json.key}`)
    expect(bucket.put).toHaveBeenCalledTimes(1)
  })
})
