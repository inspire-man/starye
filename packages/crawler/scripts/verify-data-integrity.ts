/* eslint-disable node/prefer-global/process */
/**
 * 数据完整性验证脚本
 * 验证影片、女优、厂商数据是否正确入库
 */

import 'dotenv/config'

const API_URL = process.env.API_URL || 'http://localhost:8787'
const API_TOKEN = process.env.CRAWLER_SECRET || ''

async function verifyDataIntegrity() {
  console.log('🔍 开始验证数据完整性\n')

  try {
    // 1. 验证女优数据
    console.log('1️⃣ 验证女优数据...')
    const actorsResponse = await fetch(`${API_URL}/api/admin/actors?limit=50`, {
      headers: {
        'x-service-token': API_TOKEN,
      },
    })

    if (!actorsResponse.ok) {
      console.error(`❌ 女优API请求失败: ${actorsResponse.status}`)
    }
    else {
      const actorsData = await actorsResponse.json() as any
      const actors = actorsData.actors || []
      console.log(`  ✅ 女优总数: ${actors.length}`)

      // 统计数据源
      const seesaaWikiActors = actors.filter((a: any) => a.source === 'seesaawiki')
      const javbusActors = actors.filter((a: any) => a.source === 'javbus')

      console.log(`  📊 数据源分布:`)
      console.log(`     - SeesaaWiki: ${seesaaWikiActors.length}`)
      console.log(`     - JavBus: ${javbusActors.length}`)

      // 检查 SeesaaWiki 女优的数据完整性
      if (seesaaWikiActors.length > 0) {
        console.log(`\n  🔎 SeesaaWiki 女优数据完整性:`)
        let hasAvatar = 0
        let hasWikiUrl = 0
        let hasTwitter = 0
        let hasInstagram = 0
        let hasBlog = 0

        for (const actor of seesaaWikiActors) {
          if (actor.avatar)
            hasAvatar++
          if (actor.wikiUrl)
            hasWikiUrl++
          if (actor.twitter)
            hasTwitter++
          if (actor.instagram)
            hasInstagram++
          if (actor.blog)
            hasBlog++
        }

        console.log(`     - 头像: ${hasAvatar}/${seesaaWikiActors.length} (${((hasAvatar / seesaaWikiActors.length) * 100).toFixed(1)}%)`)
        console.log(`     - Wiki URL: ${hasWikiUrl}/${seesaaWikiActors.length} (${((hasWikiUrl / seesaaWikiActors.length) * 100).toFixed(1)}%)`)
        console.log(`     - Twitter: ${hasTwitter}/${seesaaWikiActors.length} (${((hasTwitter / seesaaWikiActors.length) * 100).toFixed(1)}%)`)
        console.log(`     - Instagram: ${hasInstagram}/${seesaaWikiActors.length} (${((hasInstagram / seesaaWikiActors.length) * 100).toFixed(1)}%)`)
        console.log(`     - Blog: ${hasBlog}/${seesaaWikiActors.length} (${((hasBlog / seesaaWikiActors.length) * 100).toFixed(1)}%)`)
      }
    }

    // 2. 验证厂商数据
    console.log('\n2️⃣ 验证厂商数据...')
    const publishersResponse = await fetch(`${API_URL}/api/admin/publishers?limit=50`, {
      headers: {
        'x-service-token': API_TOKEN,
      },
    })

    if (!publishersResponse.ok) {
      console.error(`❌ 厂商API请求失败: ${publishersResponse.status}`)
    }
    else {
      const publishersData = await publishersResponse.json() as any
      const publishers = publishersData.publishers || []
      console.log(`  ✅ 厂商总数: ${publishers.length}`)

      // 统计数据源
      const seesaaWikiPublishers = publishers.filter((p: any) => p.source === 'seesaawiki')
      const javbusPublishers = publishers.filter((p: any) => p.source === 'javbus')

      console.log(`  📊 数据源分布:`)
      console.log(`     - SeesaaWiki: ${seesaaWikiPublishers.length}`)
      console.log(`     - JavBus: ${javbusPublishers.length}`)

      // 检查 SeesaaWiki 厂商的数据完整性
      if (seesaaWikiPublishers.length > 0) {
        console.log(`\n  🔎 SeesaaWiki 厂商数据完整性:`)
        let hasLogo = 0
        let hasWikiUrl = 0
        let hasTwitter = 0
        let hasInstagram = 0
        let hasWebsite = 0

        for (const publisher of seesaaWikiPublishers) {
          if (publisher.logo)
            hasLogo++
          if (publisher.wikiUrl)
            hasWikiUrl++
          if (publisher.twitter)
            hasTwitter++
          if (publisher.instagram)
            hasInstagram++
          if (publisher.website)
            hasWebsite++
        }

        console.log(`     - Logo: ${hasLogo}/${seesaaWikiPublishers.length} (${((hasLogo / seesaaWikiPublishers.length) * 100).toFixed(1)}%)`)
        console.log(`     - Wiki URL: ${hasWikiUrl}/${seesaaWikiPublishers.length} (${((hasWikiUrl / seesaaWikiPublishers.length) * 100).toFixed(1)}%)`)
        console.log(`     - 官网: ${hasWebsite}/${seesaaWikiPublishers.length} (${((hasWebsite / seesaaWikiPublishers.length) * 100).toFixed(1)}%)`)
        console.log(`     - Twitter: ${hasTwitter}/${seesaaWikiPublishers.length} (${((hasTwitter / seesaaWikiPublishers.length) * 100).toFixed(1)}%)`)
        console.log(`     - Instagram: ${hasInstagram}/${seesaaWikiPublishers.length} (${((hasInstagram / seesaaWikiPublishers.length) * 100).toFixed(1)}%)`)
      }
    }

    // 3. 验证影片数据
    console.log('\n3️⃣ 验证影片数据...')
    const moviesResponse = await fetch(`${API_URL}/api/admin/movies?limit=50`, {
      headers: {
        'x-service-token': API_TOKEN,
      },
    })

    if (!moviesResponse.ok) {
      console.error(`❌ 影片API请求失败: ${moviesResponse.status}`)
    }
    else {
      const moviesData = await moviesResponse.json() as any
      const movies = moviesData.movies || []
      console.log(`  ✅ 影片总数: ${movies.length}`)

      if (movies.length > 0) {
        console.log(`\n  🔎 影片数据完整性:`)
        let hasCover = 0
        let hasActors = 0
        let hasPublisher = 0

        for (const movie of movies) {
          if (movie.coverImage)
            hasCover++
          if (movie.actors && movie.actors.length > 0)
            hasActors++
          if (movie.publisher)
            hasPublisher++
        }

        console.log(`     - 封面: ${hasCover}/${movies.length} (${((hasCover / movies.length) * 100).toFixed(1)}%)`)
        console.log(`     - 女优: ${hasActors}/${movies.length} (${((hasActors / movies.length) * 100).toFixed(1)}%)`)
        console.log(`     - 厂商: ${hasPublisher}/${movies.length} (${((hasPublisher / movies.length) * 100).toFixed(1)}%)`)
      }
    }

    console.log('\n✅ 数据完整性验证完成')
  }
  catch (error) {
    console.error('\n❌ 验证失败:', error)
  }
}

verifyDataIntegrity().catch(console.error)
