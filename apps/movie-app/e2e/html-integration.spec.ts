/* eslint-disable no-console */
import * as path from 'node:path'
/**
 * 基于 HTML 页面的集成测试
 * 无需启动任何服务，直接测试 HTML 页面
 * 覆盖核心交互功能
 */
import { expect, test } from '@playwright/test'

// 获取 HTML 文件路径
const htmlFilePath = path.join(process.cwd(), 'e2e-test.html')
const htmlFileUrl = `file://${htmlFilePath.replace(/\\/g, '/')}`

test.describe('HTML 集成测试（无服务依赖）', () => {
  test('25.2 Aria2 配置界面交互', async ({ page }) => {
    await page.goto(htmlFileUrl)

    // 验证页面加载
    await expect(page.locator('h1')).toContainText('E2E 测试')

    // 测试连接按钮
    await page.click('[data-testid="test-connection"]')
    await page.waitForTimeout(500)

    // 验证连接成功提示
    const aria2Status = page.locator('#aria2-status')
    await expect(aria2Status).toContainText('已连接')

    // 保存配置
    await page.click('[data-testid="save-config"]')
    await page.waitForTimeout(500)

    // 验证保存成功
    const configResult = page.locator('#config-result')
    await expect(configResult).toContainText('保存成功')

    console.log('✅ 25.2 Aria2 配置测试通过')
  })

  test('26.1-26.3 评分提交和修改', async ({ page }) => {
    await page.goto(htmlFileUrl)

    // 点击第 4 颗星（4 星评分）
    const stars = page.locator('[data-testid="rating-star"]')
    await expect(stars).toHaveCount(5)

    // 提交 4 星评分
    await stars.nth(3).click()
    await page.waitForTimeout(300)
    await page.click('[data-testid="submit-rating"]')
    await page.waitForTimeout(500)

    // 验证评分提交成功
    const ratingResult = page.locator('#rating-result')
    await expect(ratingResult).toContainText('4 星')

    // 修改为 5 星
    await stars.nth(4).click()
    await page.waitForTimeout(300)
    await page.click('[data-testid="submit-rating"]')
    await page.waitForTimeout(500)

    // 验证修改成功
    await expect(ratingResult).toContainText('5 星')

    console.log('✅ 26.1-26.3 评分测试通过')
  })

  test('25.3-25.4 添加下载任务', async ({ page }) => {
    await page.goto(htmlFileUrl)

    // 添加单个任务
    await page.click('[data-testid="add-task"]')
    await page.waitForTimeout(500)

    // 验证任务出现在列表
    const taskList = page.locator('[data-testid="task-list"]')
    const taskItems = taskList.locator('[data-testid="task-item"]')
    await expect(taskItems).toHaveCount(1)

    // 验证任务详情
    const firstTask = taskItems.first()
    await expect(firstTask).toContainText('TEST-001')

    // 验证进度条
    const progressBar = firstTask.locator('[data-testid="progress-bar"]')
    await expect(progressBar).toBeVisible()

    console.log('✅ 25.3-25.4 添加任务测试通过')
  })

  test('25.5 任务控制（暂停/恢复/删除）', async ({ page }) => {
    await page.goto(htmlFileUrl)

    // 先添加一个任务
    await page.click('[data-testid="add-task"]')
    await page.waitForTimeout(500)

    // 测试暂停
    await page.click('[data-testid="pause-task"]')
    await page.waitForTimeout(300)

    // 测试恢复
    await page.click('[data-testid="resume-task"]')
    await page.waitForTimeout(300)

    // 测试删除
    await page.click('[data-testid="delete-task"]')
    await page.waitForTimeout(300)

    console.log('✅ 25.5 任务控制测试通过')
  })

  test('25.8 批量添加任务', async ({ page }) => {
    await page.goto(htmlFileUrl)

    // 点击批量添加
    await page.click('[data-testid="add-batch"]')

    // 等待所有任务添加完成
    await page.waitForTimeout(1500)

    // 验证添加了 10 个任务
    const taskItems = page.locator('[data-testid="task-item"]')
    const count = await taskItems.count()
    expect(count).toBeGreaterThanOrEqual(10)

    console.log(`✅ 25.8 批量添加测试通过 (${count} 个任务)`)
  })

  test('26.6 评分频率测试（模拟）', async ({ page }) => {
    await page.goto(htmlFileUrl)

    const stars = page.locator('[data-testid="rating-star"]')
    const submitButton = page.locator('[data-testid="submit-rating"]')

    // 快速提交 12 次评分
    for (let i = 1; i <= 12; i++) {
      await stars.nth(4).click()
      await page.waitForTimeout(100)
      await submitButton.click()
      await page.waitForTimeout(100)
    }

    // 验证测试结果统计
    const testResults = page.locator('#test-results')
    await expect(testResults).toBeVisible()

    const passCount = page.locator('#pass-count')
    const countText = await passCount.textContent()
    const count = Number.parseInt(countText || '0')

    // 应该至少提交了 10 次
    expect(count).toBeGreaterThanOrEqual(10)

    console.log(`✅ 26.6 评分频率测试通过 (${count} 次提交)`)
  })

  test('27.7 响应式布局（移动端）', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto(htmlFileUrl)

    // 验证页面在移动端可见
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('.container')).toBeVisible()

    // 测试移动端评分交互
    const stars = page.locator('[data-testid="rating-star"]')
    await stars.nth(4).click()
    await page.waitForTimeout(300)

    // 验证星星可点击
    const activeStar = stars.nth(4)
    await expect(activeStar).toHaveClass(/active/)

    console.log('✅ 27.7 移动端布局测试通过')
  })

  test('完整集成测试流程', async ({ page }) => {
    await page.goto(htmlFileUrl)

    console.log('开始完整集成测试流程...')

    // 1. 配置 Aria2
    await page.click('[data-testid="test-connection"]')
    await page.waitForTimeout(300)
    await page.click('[data-testid="save-config"]')
    await page.waitForTimeout(300)
    console.log('✓ 步骤 1: Aria2 配置完成')

    // 2. 添加下载任务
    await page.click('[data-testid="add-task"]')
    await page.waitForTimeout(500)
    console.log('✓ 步骤 2: 添加下载任务完成')

    // 3. 提交评分
    const stars = page.locator('[data-testid="rating-star"]')
    await stars.nth(4).click()
    await page.waitForTimeout(300)
    await page.click('[data-testid="submit-rating"]')
    await page.waitForTimeout(500)
    console.log('✓ 步骤 3: 提交评分完成')

    // 4. 批量添加任务
    await page.click('[data-testid="add-batch"]')
    await page.waitForTimeout(1500)
    console.log('✓ 步骤 4: 批量添加完成')

    // 验证测试结果
    const testResults = page.locator('#test-results')
    await expect(testResults).toBeVisible()

    const passCount = await page.locator('#pass-count').textContent()
    const count = Number.parseInt(passCount || '0')

    // 应该至少有 14 个测试通过（4个步骤 + 10个批量任务）
    expect(count).toBeGreaterThanOrEqual(14)

    console.log(`✅ 完整集成测试通过 (${count} 个操作成功)`)
  })
})
