import { Agent as HttpAgent } from 'node:http'
import { Agent as HttpsAgent } from 'node:https'
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import got from 'got'
import sharp from 'sharp'
import { z } from 'zod'

// Configuration Schema
export const R2ConfigSchema = z.object({
  accountId: z.string(),
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  bucketName: z.string(),
  publicUrl: z.string(), // e.g. https://cdn.starye.com
})

export type R2Config = z.infer<typeof R2ConfigSchema>

export type ImageVariant = 'thumb' | 'preview' | 'original'

export interface ProcessedImage {
  key: string
  url: string
  variant: ImageVariant
  width?: number
  height?: number
  size: number
}

export class ImageProcessor {
  private s3: S3Client
  private bucket: string
  private publicUrl: string
  private httpAgent: HttpAgent
  private httpsAgent: HttpsAgent

  constructor(config: R2Config) {
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
    this.bucket = config.bucketName
    this.publicUrl = config.publicUrl

    // Optimized agents for high concurrency
    this.httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 100 })
    this.httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 100 })
  }

  /**
   * Process an image URL: download, resize/convert, and upload to R2
   * @param imageUrl Source URL
   * @param keyPrefix Prefix for R2 keys (e.g. "comics/one-piece/ch1")
   * @param filename Base filename without extension (e.g. "001")
   */
  async process(imageUrl: string, keyPrefix: string, filename: string): Promise<ProcessedImage[]> {
    // Create the main pipeline
    const pipeline = sharp({ failOn: 'none' })

    // Start downloading and pipe to sharp
    const downloadStream = got.stream(imageUrl, {
      agent: {
        http: this.httpAgent,
        https: this.httpsAgent,
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Referer': new URL(imageUrl).origin,
      },
      timeout: {
        request: 60000, // Increased timeout
      },
      retry: {
        limit: 5, // Increased retries
      },
    })

    downloadStream.on('error', (err) => {
      // Prevent unhandled error event crash
      // The error will likely propagate to the pipeline or result in broken streams that subsequent tasks will detect
      console.warn(`[ImageProcessor] Download stream error for ${imageUrl}: ${err.message}`)
    })

    downloadStream.pipe(pipeline)

    // Define variants
    const tasks = [
      this.uploadVariant(pipeline, keyPrefix, filename, 'thumb', { width: 300, quality: 80 }),
      this.uploadVariant(pipeline, keyPrefix, filename, 'preview', { width: 800, quality: 85 }),
      this.uploadVariant(pipeline, keyPrefix, filename, 'original', { quality: 90 }),
    ]

    try {
      return await Promise.all(tasks)
    }
    catch (error) {
      console.error(`Failed to process image ${imageUrl}:`, error)
      throw error
    }
  }

  private async uploadVariant(
    pipeline: sharp.Sharp,
    prefix: string,
    filename: string,
    variant: ImageVariant,
    options: { width?: number, quality: number },
  ): Promise<ProcessedImage> {
    const key = `${prefix}/${filename}-${variant}.webp`

    // Clone pipeline for this specific variant
    let processor = pipeline.clone()

    // Resize if needed (maintain aspect ratio)
    if (options.width) {
      processor = processor.resize({ width: options.width, withoutEnlargement: true })
    }

    // Convert to WebP
    processor = processor.webp({ quality: options.quality, effort: 4 }) // Effort 4 is a good balance

    // Use PassThrough stream to connect Sharp output to S3 Upload
    // Note: Sharp -> PassThrough -> S3 Upload
    // However, Sharp instances are readable streams themselves if we don't call toBuffer/toFile
    // But @aws-sdk/lib-storage expects a body.

    // Correct way: Upload can accept a readable stream.
    // Sharp IS a duplex stream, but `.clone()` returns a Sharp instance which is readable.

    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: processor, // Pipe directly!
        ContentType: 'image/webp',
      },
    })

    // Wait for upload to complete
    await upload.done()

    // We can't easily get width/height/size from the stream without metadata probe    // For now, we trust the process. If metadata is critical, we might need a separate probe pipeline.

    return {
      key,
      url: `${this.publicUrl}/${key}`,
      variant,
      size: 0, // Stream upload doesn't easily return size immediately in all cases, or we need to capture it from upload result if available
    }
  }
}
