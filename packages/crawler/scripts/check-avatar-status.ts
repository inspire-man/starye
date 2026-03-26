/* eslint-disable node/prefer-global/process */
/**
 * 检查当前头像状态（多少已在R2，多少需要补全）
 */

const CRAWLER_SECRET = process.env.CRAWLER_SECRET || 'your-secret-token'

async function checkStatus() {
  try {
    console.log('🔍 检查女优头像状态...\n')

    const response = await fetch(`${API_URL}/api/admin/actors/pending?limit=500`, {
      headers: {
        'x-service-token': CRAWLER_SECRET,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data: any = await response.json()

    console.log(`📊 统计结果:`)
    console.log(`   总计: ${data.total} 个女优`)
    console.log(`   高优先级（作品数>=10）: ${data.highPriority} 个`)
    console.log(`   需要头像补全: ${data.needsAvatarUpdate} 个`)
    console.log(`   需要完整爬取: ${data.total - data.needsAvatarUpdate} 个\n`)

    // 分组展示前10个
    const needUpdate = data.actors.filter((a: any) => a.needsAvatarUpdate).slice(0, 10)
    const needFull = data.actors.filter((a: any) => !a.needsAvatarUpdate).slice(0, 10)

    if (needUpdate.length > 0) {
      console.log('🔄 需要头像补全的女优（前10个）:')
      needUpdate.forEach((a: any) => {
        console.log(`   - ${a.name} (作品数: ${a.movieCount})`)
      })
      console.log()
    }

    if (needFull.length > 0) {
      console.log('📥 需要完整爬取的女优（前10个）:')
      needFull.forEach((a: any) => {
        console.log(`   - ${a.name} (作品数: ${a.movieCount})`)
      })
      console.log()
    }
  }
  catch (error) {
    console.error('❌ 检查失败:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

checkStatus()
