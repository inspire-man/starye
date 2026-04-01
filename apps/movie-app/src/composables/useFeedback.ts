/**
 * 用户反馈收集 Composable
 *
 * 用于灰度测试期间收集用户反馈
 */

import { ref } from 'vue'
import { useToast } from './useToast'

export interface FeedbackItem {
  id: string
  type: 'bug' | 'suggestion' | 'question' | 'praise'
  feature: 'aria2' | 'rating' | 'other'
  content: string
  contact?: string
  timestamp: number
  userAgent: string
  url: string
}

const { toast } = useToast()

/**
 * 使用反馈收集
 */
export function useFeedback() {
  const submitting = ref(false)

  /**
   * 提交反馈
   */
  async function submitFeedback(feedback: Omit<FeedbackItem, 'id' | 'timestamp' | 'userAgent' | 'url'>): Promise<boolean> {
    submitting.value = true

    try {
      const fullFeedback: FeedbackItem = {
        ...feedback,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }

      // 发送到服务器
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fullFeedback),
      })

      if (!response.ok) {
        throw new Error('提交失败')
      }

      toast({
        title: '反馈已提交',
        description: '感谢您的宝贵意见！',
      })

      return true
    }
    catch {
      // 保存到本地存储
      saveFeedbackLocally(feedback)

      toast({
        title: '提交失败',
        description: '反馈已保存到本地，稍后会自动重试',
        variant: 'destructive',
      })

      return false
    }
    finally {
      submitting.value = false
    }
  }

  /**
   * 保存反馈到本地存储
   */
  function saveFeedbackLocally(feedback: Omit<FeedbackItem, 'id' | 'timestamp' | 'userAgent' | 'url'>) {
    try {
      const pending = JSON.parse(localStorage.getItem('pendingFeedback') || '[]')
      pending.push({
        ...feedback,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      })
      localStorage.setItem('pendingFeedback', JSON.stringify(pending))
    }
    catch (error) {
      console.error('保存反馈到本地失败', error)
    }
  }

  /**
   * 重试提交本地存储的反馈
   */
  async function retryPendingFeedback() {
    try {
      const pending = JSON.parse(localStorage.getItem('pendingFeedback') || '[]') as FeedbackItem[]

      if (pending.length === 0)
        return

      // 重试提交待处理的反馈

      for (const feedback of pending) {
        try {
          const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(feedback),
          })

          if (response.ok) {
            // 成功，从本地移除
            const updated = pending.filter(f => f.id !== feedback.id)
            localStorage.setItem('pendingFeedback', JSON.stringify(updated))
          }
        }
        catch {
          // 继续尝试下一条
        }
      }
    }
    catch (error) {
      console.error('重试反馈失败', error)
    }
  }

  /**
   * 快速反馈（预设模板）
   */
  async function quickFeedback(
    feature: 'aria2' | 'rating',
    sentiment: 'good' | 'bad',
    comment?: string,
  ): Promise<boolean> {
    const type = sentiment === 'good' ? 'praise' : 'bug'
    const content = comment || (sentiment === 'good' ? '功能很好用！' : '遇到了一些问题')

    return await submitFeedback({
      type,
      feature,
      content,
    })
  }

  return {
    submitting,
    submitFeedback,
    retryPendingFeedback,
    quickFeedback,
  }
}
