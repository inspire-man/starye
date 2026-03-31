# 未匹配女优人工审核流程

**文档版本**: 1.0  
**最后更新**: 2026-03-31  
**目标**: 提高高优先级女优的数据覆盖率

## 为什么需要人工审核

虽然自动名字映射可以覆盖 85-95% 的女优，但仍有一些情况需要人工介入：

1. **名字变体**: JavBus 和 SeesaaWiki 使用不同的名字格式
   - 示例：JavBus "桜井彩" vs SeesaaWiki "さくらい あや"
2. **别名未覆盖**: 女优的某些别名未被索引爬虫发现
3. **新入行女优**: 在 SeesaaWiki 添加但索引未及时更新
4. **OCR 错误**: 索引爬虫可能误读某些日文字符

## 审核优先级

按作品数量划分优先级：

| 优先级 | 作品数 | 预计数量 | 处理策略 |
|--------|-------|---------|---------|
| **P0** | > 100 | 50-100个 | **必须人工补充** |
| **P1** | 50-100 | 100-200个 | 建议人工补充 |
| **P2** | 20-50 | 300-500个 | 可选补充 |
| **P3** | < 20 | 500-1000个 | 忽略 |

**策略说明**:
- P0 和 P1 女优影响大量影片的数据质量，应优先处理
- P2 女优可在有时间时补充
- P3 女优作品少，对整体数据质量影响小，可忽略

## 审核流程

### 步骤 1: 导出待审核清单

```bash
cd packages/crawler

# 导出 P0 优先级女优（作品数 > 100）
cat .unmapped-actors.json | jq '[.[] | select(.movieCount > 100)] | sort_by(.movieCount) | reverse' > unmapped-p0.json

# 导出 P1 优先级女优（作品数 50-100）
cat .unmapped-actors.json | jq '[.[] | select(.movieCount > 50 and .movieCount <= 100)] | sort_by(.movieCount) | reverse' > unmapped-p1.json
```

**输出示例** (`unmapped-p0.json`):
```json
[
  {
    "name": "美波もも",
    "movieCount": 150,
    "attempts": ["cache", "exact", "index"],
    "lastAttempt": 1711843200
  },
  {
    "name": "桃乃木かな",
    "movieCount": 120,
    "attempts": ["cache", "exact"],
    "lastAttempt": 1711843100
  }
]
```

### 步骤 2: 在 SeesaaWiki 搜索

对于每个未匹配女优：

1. **访问 SeesaaWiki**
   ```
   https://seesaawiki.jp/w/sougouwiki/
   ```

2. **尝试多种搜索方式**
   - 原名搜索：如 "美波もも"
   - 平假名搜索：如 "みなみ もも"
   - 片假名搜索：如 "ミナミ モモ"
   - 部分匹配：搜索姓或名

3. **验证页面**
   - 检查出演作品是否匹配
   - 检查照片是否一致
   - 确认是同一人

### 步骤 3: 手动添加映射

找到正确页面后，添加到 `.actor-name-map.json`:

```bash
# 使用文本编辑器打开
vim .actor-name-map.json

# 或使用 jq 添加（推荐）
jq '. += [{
  "javbusName": "美波もも",
  "wikiName": "美波もも",
  "wikiUrl": "https://seesaawiki.jp/w/sougouwiki/d/...",
  "lastUpdated": '$(date +%s)'
}]' .actor-name-map.json > .actor-name-map.tmp.json
mv .actor-name-map.tmp.json .actor-name-map.json
```

**注意事项**:
- ✅ `wikiUrl` 必须使用 EUC-JP 编码（从浏览器地址栏复制）
- ✅ `javbusName` 使用 JavBus 上显示的名字
- ✅ `wikiName` 使用 SeesaaWiki 标准名字
- ✅ `lastUpdated` 使用当前 Unix 时间戳

### 步骤 4: 从未匹配清单移除

```bash
# 使用 jq 移除已处理的女优
jq 'map(select(.name != "美波もも"))' .unmapped-actors.json > .unmapped-actors.tmp.json
mv .unmapped-actors.tmp.json .unmapped-actors.json
```

### 步骤 5: 验证映射

```bash
# 运行单个女优的测试脚本（可选，需要创建）
pnpm tsx scripts/test-single-actor.ts "美波もも"
```

**预期结果**:
- ✅ 成功访问 SeesaaWiki 页面
- ✅ 正确提取头像和详细信息
- ✅ 数据完整度 > 50%

### 步骤 6: 提交映射更新

```bash
git add .actor-name-map.json .unmapped-actors.json
git commit -m "feat: 添加高优先级女优映射 - 美波もも 等"
git push
```

### 步骤 7: 触发详情爬虫

更新映射后，触发女优详情爬虫以拉取数据：

```bash
# 本地测试
MAX_ACTORS=10 pnpm crawl:actor

# 或通过 GitHub Actions
gh workflow run daily-actor-crawl.yml
```

## 批量审核工具（推荐）

### 创建交互式审核脚本

创建 `scripts/interactive-actor-mapping.ts`:

```typescript
import inquirer from 'inquirer'
import { SeesaaWikiStrategy } from '../src/strategies/seesaawiki/seesaawiki-strategy'
import puppeteer from 'puppeteer'

async function main() {
  // 1. 读取未匹配清单
  const unmapped = JSON.parse(fs.readFileSync('.unmapped-actors.json', 'utf-8'))
  const highPriority = unmapped.filter(a => a.movieCount > 50)
  
  console.log(`共 ${highPriority.length} 个高优先级女优待审核`)
  
  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()
  
  for (const actor of highPriority) {
    console.log(`\n女优: ${actor.name} (${actor.movieCount} 作品)`)
    
    // 2. 打开 SeesaaWiki 搜索页
    const searchUrl = `https://seesaawiki.jp/w/sougouwiki/search?keyword=${encodeURIComponent(actor.name)}`
    await page.goto(searchUrl)
    
    // 3. 询问用户
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'found',
        message: '是否找到该女优？',
      },
      {
        type: 'input',
        name: 'wikiUrl',
        message: '请输入 SeesaaWiki URL:',
        when: (answers) => answers.found,
      },
    ])
    
    // 4. 保存映射
    if (answer.found) {
      saveMapping(actor.name, answer.wikiUrl)
      console.log('✅ 映射已保存')
    } else {
      console.log('⏭️  跳过')
    }
  }
  
  await browser.close()
  console.log('\n✅ 审核完成')
}
```

### 使用交互式工具

```bash
# 安装依赖
pnpm add -D inquirer @types/inquirer

# 运行交互式审核
pnpm tsx scripts/interactive-actor-mapping.ts
```

**优点**:
- 自动打开搜索页面
- 交互式输入，减少手动操作
- 自动保存映射和更新清单
- 支持批量处理

## 常见问题

### Q: 如何判断映射是否正确？

A: 三个验证点：
1. 页面标题包含女优名字
2. 出演作品列表与 JavBus 匹配
3. 照片与 JavBus 一致

### Q: 找不到女优怎么办？

A: 可能原因：
1. SeesaaWiki 确实没有该女优的词条（新人或冷门女优）
2. 使用了完全不同的名字（需要更多搜索尝试）
3. 被归类到了其他页面（如团体页面）

**处理方式**：保留在未匹配清单中，等待 SeesaaWiki 添加词条。

### Q: 批量审核需要多长时间？

A: 预计时间：
- P0 优先级（50-100个）：2-3小时
- P1 优先级（100-200个）：4-6小时

建议分多次完成，每次处理 20-30 个。

### Q: 可以自动化人工审核吗？

A: 部分可以，但完全自动化困难：
- ✅ 自动搜索：可以自动在 SeesaaWiki 搜索
- ❌ 结果验证：需要人工确认是否为同一人
- ⚠️ 模糊匹配：可以用 AI 辅助，但准确率有限

## 审核记录

### 维护审核日志

建议在每次人工审核后记录：

**文件**: `docs/actor-mapping-audit-log.md`

```markdown
## 2026-04-07 审核记录

- 审核人：张三
- 审核范围：P0 优先级（作品数 > 100）
- 处理数量：25 个
- 成功映射：20 个
- 无法映射：5 个
- 耗时：1.5 小时

### 新增映射
- 美波もも → 美波もも
- 桃乃木かな → 桃乃木かな
- ...

### 无法映射（原因）
- 未知女优A：SeesaaWiki 无词条
- 未知女优B：名字完全不同，无法确认
```

## 相关文档

- [名字映射表维护指南](./name-mapping-maintenance-guide.md)
- [SeesaaWiki 数据源设计](../openspec/changes/integrate-seesaawiki-data-source/design.md)
- [映射质量报告](./mapping-quality-report-template.md)（模板）
