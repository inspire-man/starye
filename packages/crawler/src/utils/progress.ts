/* eslint-disable no-console */
/**
 * 进度监控工具类
 */

import cliProgress from 'cli-progress'

export interface ProgressStats {
  moviesFound: number
  moviesProcessed: number
  moviesSuccess: number
  moviesFailed: number
  imagesDownloaded: number
  apiSynced: number
  moviesSkippedExisting: number
  startTime: number
}

export class ProgressMonitor {
  private progressBar: cliProgress.SingleBar | null = null
  private multibar: cliProgress.MultiBar | null = null
  private statsInterval: NodeJS.Timeout | null = null
  private stats: ProgressStats
  private useIncrementalMode: boolean = false

  constructor(private maxMovies: number = 0, private showProgress: boolean = true) {
    this.stats = {
      moviesFound: 0,
      moviesProcessed: 0,
      moviesSuccess: 0,
      moviesFailed: 0,
      imagesDownloaded: 0,
      apiSynced: 0,
      moviesSkippedExisting: 0,
      startTime: Date.now(),
    }
  }

  init(): void {
    if (!this.showProgress || this.maxMovies === 0) {
      return
    }

    this.multibar = new cliProgress.MultiBar({
      format: '进度 |{bar}| {percentage}% | {value}/{total} | 剩余: {eta}s | {status}',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
    }, cliProgress.Presets.shades_classic)

    this.progressBar = this.multibar.create(this.maxMovies, 0, { status: '准备中...' })
  }

  update(status: string): void {
    if (this.progressBar) {
      // 在增量模式下，动态更新进度条的总数为实际需要处理的影片数
      // 计算需要处理的影片数 = 已发现 - 已跳过
      const targetTotal = this.stats.moviesFound - this.stats.moviesSkippedExisting

      if (this.useIncrementalMode && targetTotal > 0) {
        // 动态调整进度条总数
        this.progressBar.setTotal(targetTotal)
      }

      this.progressBar.update(this.stats.moviesSuccess, { status })
    }
  }

  /**
   * 启用增量模式进度跟踪
   * 在增量模式下，进度条总数会动态调整为实际需要处理的影片数
   */
  enableIncrementalMode(): void {
    this.useIncrementalMode = true
  }

  startStatsMonitor(interval: number, onUpdate: (stats: ProgressStats) => void): void {
    this.statsInterval = setInterval(() => {
      onUpdate(this.stats)
    }, interval)
  }

  stopStatsMonitor(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
      this.statsInterval = null
    }
  }

  stop(): void {
    this.stopStatsMonitor()

    if (this.progressBar) {
      this.progressBar.stop()
      this.progressBar = null
    }

    if (this.multibar) {
      this.multibar.stop()
      this.multibar = null
    }
  }

  getStats(): ProgressStats {
    return { ...this.stats }
  }

  incrementMoviesFound(count: number = 1): void {
    this.stats.moviesFound += count
  }

  incrementMoviesProcessed(): void {
    this.stats.moviesProcessed++
  }

  incrementMoviesSuccess(): void {
    this.stats.moviesSuccess++
  }

  incrementMoviesFailed(): void {
    this.stats.moviesFailed++
  }

  incrementImagesDownloaded(): void {
    this.stats.imagesDownloaded++
  }

  incrementApiSynced(): void {
    this.stats.apiSynced++
  }

  /**
   * 增量统计：累计跳过的已存在影片数量
   * 用于计算增量命中率（已存在 / 总发现）
   */
  incrementMoviesSkippedExisting(count: number = 1): void {
    this.stats.moviesSkippedExisting += count
  }

  printStats(): void {
    const elapsed = Math.round((Date.now() - this.stats.startTime) / 1000)
    const rate = elapsed > 0 ? (this.stats.moviesSuccess / elapsed * 60).toFixed(2) : '0.00'
    const incrementalHitRate = this.stats.moviesFound > 0
      ? ((this.stats.moviesSkippedExisting / this.stats.moviesFound) * 100).toFixed(1)
      : '0.0'
    const newMoviesCount = this.stats.moviesFound - this.stats.moviesSkippedExisting
    const processRate = newMoviesCount > 0
      ? ((this.stats.moviesSuccess / newMoviesCount) * 100).toFixed(1)
      : '0.0'

    console.log('\n📈 爬虫统计:')
    console.log(`  运行时间: ${elapsed}s`)
    console.log(`  发现影片: ${this.stats.moviesFound}`)
    console.log(`  已存在: ${this.stats.moviesSkippedExisting} (${incrementalHitRate}%)`)
    console.log(`  新增: ${newMoviesCount} (${(100 - Number.parseFloat(incrementalHitRate)).toFixed(1)}%)`)
    console.log(`  处理进度: ${this.stats.moviesSuccess}/${newMoviesCount} (${processRate}%)`)
    console.log(`  成功: ${this.stats.moviesSuccess}`)
    console.log(`  失败: ${this.stats.moviesFailed}`)
    console.log(`  图片下载: ${this.stats.imagesDownloaded}`)
    console.log(`  API 同步: ${this.stats.apiSynced}`)
    console.log(`  处理速度: ${rate} 部/分钟`)
  }
}
