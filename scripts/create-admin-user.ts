/**
 * 直接创建/更新用户权限脚本
 * 使用数据库直接操作
 */

import process from 'node:process'
import 'dotenv/config'

async function createOrUpdateUser(email: string) {
  console.log(`🔧 配置用户: ${email}\n`)

  try {
    // 检查用户是否存在
    const { execSync } = await import('node:child_process')

    const checkUserCmd = `wrangler d1 execute starye-db --local --command "SELECT * FROM user WHERE email = '${email}'"`
    console.log('1️⃣ 检查用户是否存在...')

    let output = ''
    try {
      output = execSync(checkUserCmd, { cwd: 'd:/my-workspace/starye', encoding: 'utf8' })
      console.log(output)
    }
    catch (error: any) {
      console.error('执行查询失败:', error.message)
    }

    // 如果用户不存在，创建用户
    if (output.includes('no rows') || output.includes('0 row')) {
      console.log('\n2️⃣ 用户不存在，创建新用户...')
      const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const now = Math.floor(Date.now() / 1000)

      const createUserCmd = `wrangler d1 execute starye-db --local --command "INSERT INTO user (id, name, email, email_verified, role, is_r18_verified, created_at, updated_at) VALUES ('${userId}', '${email.split('@')[0]}', '${email}', 1, 'admin', 1, ${now}, ${now})"`

      try {
        const createOutput = execSync(createUserCmd, { cwd: 'd:/my-workspace/starye', encoding: 'utf8' })
        console.log(createOutput)
        console.log('  ✅ 用户创建成功')
        console.log(`     角色: admin`)
        console.log(`     R18验证: true`)
      }
      catch (error: any) {
        console.error('❌ 创建用户失败:', error.message)
        return
      }
    }
    else {
      // 如果用户存在，更新权限
      console.log('\n2️⃣ 用户已存在，更新权限...')
      const updateUserCmd = `wrangler d1 execute starye-db --local --command "UPDATE user SET role = 'admin', is_r18_verified = 1, updated_at = ${Math.floor(Date.now() / 1000)} WHERE email = '${email}'"`

      try {
        const updateOutput = execSync(updateUserCmd, { cwd: 'd:/my-workspace/starye', encoding: 'utf8' })
        console.log(updateOutput)
        console.log('  ✅ 用户权限已更新')
        console.log(`     角色: → admin`)
        console.log(`     R18验证: → true`)
      }
      catch (error: any) {
        console.error('❌ 更新用户权限失败:', error.message)
        return
      }
    }

    // 3. 验证更新结果
    console.log('\n3️⃣ 验证更新结果...')
    try {
      const verifyOutput = execSync(checkUserCmd, { cwd: 'd:/my-workspace/starye', encoding: 'utf8' })
      console.log(verifyOutput)
    }
    catch (error: any) {
      console.error('验证失败:', error.message)
    }

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
createOrUpdateUser(email).catch(console.error)
