import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useAria2WebSocket } from './useAria2WebSocket'

// Mock WebSocket
class MockWebSocket {
  public onopen: ((event: Event) => void) | null = null
  public onclose: ((event: CloseEvent) => void) | null = null
  public onerror: ((event: Event) => void) | null = null
  public onmessage: ((event: MessageEvent) => void) | null = null
  public readyState: number = 1
  public url: string

  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  constructor(url: string) {
    this.url = url
    this.readyState = MockWebSocket.OPEN

    // 自动触发 onopen
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'))
      }
    }, 0)
  }

  send(data: string) {
    // Mock send
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close'))
    }
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }
}

global.WebSocket = MockWebSocket as any

describe('useAria2WebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('连接管理', () => {
    it('应该提供连接方法', () => {
      const { connect, disconnect, connectionState } = useAria2WebSocket()

      expect(typeof connect).toBe('function')
      expect(typeof disconnect).toBe('function')
      expect(connectionState).toBeDefined()
    })

    it('应该能断开连接', () => {
      const { disconnect, connectionState } = useAria2WebSocket()

      disconnect()

      expect(connectionState.value).toBe('disconnected')
    })
  })

  describe('任务监听', () => {
    it('应该提供任务监听方法', () => {
      const { watchTask, unwatchTask } = useAria2WebSocket()

      expect(typeof watchTask).toBe('function')
      expect(typeof unwatchTask).toBe('function')
    })
  })

  describe('工具函数', () => {
    it('应该提供必要的状态和方法', () => {
      const ws = useAria2WebSocket()

      expect(ws.connectionState).toBeDefined()
      expect(typeof ws.connect).toBe('function')
      expect(typeof ws.disconnect).toBe('function')
      expect(typeof ws.watchTask).toBe('function')
      expect(typeof ws.unwatchTask).toBe('function')
    })
  })
})
