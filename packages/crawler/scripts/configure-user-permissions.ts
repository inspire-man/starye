/* eslint-disable node/prefer-global/process */
/**
 * 配置用户权限脚本
 * 为指定用户开启管理员权限和R18访问权限
 */

import 'dotenv/config'

const API_URL = process.env.API_URL || 'http://localhost:8787'
const API_TOKEN = process.env.CRAWLER_SECRET || ''

async function configureUserPermissions(email: string) {
  console.log(`🔧 配置用户权限: ${email}\n`)

  try {
    // 1. 查找用户
    console.log('1️⃣ 查找用户...')
    const searchResponse = await fetch(
      `${API_URL}/api/admin/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'x-service-token': API_TOKEN,
        },
      },
    )

    if (!searchResponse.ok) {
      console.error(`❌ 查找用户失败: ${searchResponse.status}`)
      const errorText = await searchResponse.text()
      console.error(`   错误详情: ${errorText}`)
      return
    }

    const searchData = await searchResponse.json() as any
    const users = searchData.users || searchData.data || []

    if (users.length === 0) {
      console.log(`⚠️  未找到用户: ${email}`)
      console.log(`   请确保用户已注册登录过系统`)
      return
    }

    const user = users[0]
    console.log(`  ✅ 找到用户: ${user.name || user.email}`)
    console.log(`     ID: ${user.id}`)
    console.log(`     角色: ${user.role}`)
    console.log(`     R18验证: ${user.isR18Verified}`)

    // 2. 更新用户权限
    console.log('\n2️⃣ 更新用户权限...')
    const updateResponse = await fetch(
      `${API_URL}/api/admin/users/${user.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-service-token': API_TOKEN,
        },
        body: JSON.stringify({
          role: 'admin',
          isR18Verified: true,
        }),
      },
    )

    if (!updateResponse.ok) {
      console.error(`❌ 更新用户权限失败: ${updateResponse.status}`)
      const errorText = await updateResponse.text()
      console.error(`   错误详情: ${errorText}`)
      return
    }

    await updateResponse.json()
    console.log(`  ✅ 用户权限已更新`)
    console.log(`     角色: user → admin`)
    console.log(`     R18验证: false → true`)

    console.log('\n✅ 用户权限配置完成')
    console.log(`\n💡 用户 ${email} 现在可以：`)
    console.log(`   - 访问管理后台（/admin）`)
    console.log(`   - 查看所有R18内容`)
    console.log(`   - 管理影片、女优、厂商数据`)
  }
  catch (error) {
    console.error('\n❌ 配置失败:', error)
  }
}

const email = process.argv[2] || '1140762316@qq.com'
configureUserPermissions(email).catch(console.error)
