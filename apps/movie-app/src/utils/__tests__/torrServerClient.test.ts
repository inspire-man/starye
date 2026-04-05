import type { TorrentFile } from '../torrServerClient'
import { describe, expect, it } from 'vitest'
import { formatTorrentFileSize, TorrServerClient } from '../torrServerClient'

describe('torrServerClient', () => {
  describe('torrServerClient', () => {
    const client = new TorrServerClient({ serverUrl: 'http://localhost:8090' })

    describe('getStreamUrl', () => {
      it('应该构建正确的流 URL', () => {
        const magnet = 'magnet:?xt=urn:btih:abc123def456'
        const url = client.getStreamUrl(magnet, 0)

        expect(url).toContain('http://localhost:8090/stream/video')
        expect(url).toContain(`link=${encodeURIComponent(magnet)}`)
        expect(url).toContain('index=0')
        expect(url).toContain('play=')
      })

      it('应该正确处理不同的 fileIndex', () => {
        const magnet = 'magnet:?xt=urn:btih:abc123'
        const url = client.getStreamUrl(magnet, 3)

        expect(url).toContain('index=3')
      })

      it('应该去除 serverUrl 末尾的斜杠', () => {
        const clientWithSlash = new TorrServerClient({ serverUrl: 'http://localhost:8090/' })
        const url = clientWithSlash.getStreamUrl('magnet:?xt=urn:btih:abc', 0)

        expect(url).toContain('http://localhost:8090/stream/video')
        expect(url).not.toContain('http://localhost:8090//stream')
      })
    })

    describe('getPlaylistUrl', () => {
      it('应该构建正确的播放列表 URL', () => {
        const magnet = 'magnet:?xt=urn:btih:abc123'
        const url = client.getPlaylistUrl(magnet)

        expect(url).toContain('http://localhost:8090/playlist')
        expect(url).toContain(`link=${encodeURIComponent(magnet)}`)
      })
    })

    describe('filterVideoFiles', () => {
      it('应该过滤出视频文件', () => {
        const files: TorrentFile[] = [
          { id: 0, path: 'movie.mp4', length: 2_000_000_000 },
          { id: 1, path: 'cover.jpg', length: 500_000 },
          { id: 2, path: 'subs.srt', length: 50_000 },
          { id: 3, path: 'sample.avi', length: 50_000_000 },
        ]

        const result = client.filterVideoFiles(files)

        expect(result).toHaveLength(2)
        expect(result[0].path).toBe('movie.mp4')
        expect(result[1].path).toBe('sample.avi')
      })

      it('应该按文件大小降序排列', () => {
        const files: TorrentFile[] = [
          { id: 0, path: 'small.mp4', length: 100_000_000 },
          { id: 1, path: 'large.mkv', length: 4_500_000_000 },
          { id: 2, path: 'medium.avi', length: 2_000_000_000 },
        ]

        const result = client.filterVideoFiles(files)

        expect(result).toHaveLength(3)
        expect(result[0].path).toBe('large.mkv')
        expect(result[1].path).toBe('medium.avi')
        expect(result[2].path).toBe('small.mp4')
      })

      it('应该识别所有支持的视频扩展名', () => {
        const files: TorrentFile[] = [
          { id: 0, path: 'a.mp4', length: 100 },
          { id: 1, path: 'b.mkv', length: 100 },
          { id: 2, path: 'c.avi', length: 100 },
          { id: 3, path: 'd.ts', length: 100 },
          { id: 4, path: 'e.wmv', length: 100 },
          { id: 5, path: 'f.flv', length: 100 },
          { id: 6, path: 'g.mov', length: 100 },
          { id: 7, path: 'h.webm', length: 100 },
          { id: 8, path: 'i.m4v', length: 100 },
        ]

        const result = client.filterVideoFiles(files)
        expect(result).toHaveLength(9)
      })

      it('应该忽略非视频文件', () => {
        const files: TorrentFile[] = [
          { id: 0, path: 'readme.txt', length: 1000 },
          { id: 1, path: 'cover.jpg', length: 500_000 },
          { id: 2, path: 'subs.srt', length: 50_000 },
          { id: 3, path: 'nfo.nfo', length: 2000 },
          { id: 4, path: 'sample.png', length: 100_000 },
        ]

        const result = client.filterVideoFiles(files)
        expect(result).toHaveLength(0)
      })

      it('应该处理空文件列表', () => {
        const result = client.filterVideoFiles([])
        expect(result).toHaveLength(0)
      })

      it('应该处理嵌套路径中的视频文件', () => {
        const files: TorrentFile[] = [
          { id: 0, path: 'folder/subfolder/movie.mp4', length: 2_000_000_000 },
          { id: 1, path: 'folder/cover.jpg', length: 500_000 },
        ]

        const result = client.filterVideoFiles(files)
        expect(result).toHaveLength(1)
        expect(result[0].path).toBe('folder/subfolder/movie.mp4')
      })

      it('应该不区分大小写匹配扩展名', () => {
        const files: TorrentFile[] = [
          { id: 0, path: 'movie.MP4', length: 2_000_000_000 },
          { id: 1, path: 'video.MKV', length: 1_500_000_000 },
        ]

        const result = client.filterVideoFiles(files)
        expect(result).toHaveLength(2)
      })
    })
  })

  describe('formatTorrentFileSize', () => {
    it('应该格式化 0 字节', () => {
      expect(formatTorrentFileSize(0)).toBe('0 B')
    })

    it('应该格式化字节', () => {
      expect(formatTorrentFileSize(500)).toBe('500.00 B')
    })

    it('应该格式化 KB', () => {
      expect(formatTorrentFileSize(1024)).toBe('1.00 KB')
      expect(formatTorrentFileSize(1536)).toBe('1.50 KB')
    })

    it('应该格式化 MB', () => {
      expect(formatTorrentFileSize(1_048_576)).toBe('1.00 MB')
      expect(formatTorrentFileSize(52_428_800)).toBe('50.00 MB')
    })

    it('应该格式化 GB', () => {
      expect(formatTorrentFileSize(1_073_741_824)).toBe('1.00 GB')
      expect(formatTorrentFileSize(4_831_838_208)).toBe('4.50 GB')
    })

    it('应该格式化 TB', () => {
      expect(formatTorrentFileSize(1_099_511_627_776)).toBe('1.00 TB')
    })
  })
})
