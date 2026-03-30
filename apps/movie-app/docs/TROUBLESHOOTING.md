# 故障排查指南

> 常见问题的诊断和解决方案

---

## 📖 目录

- [Aria2 连接问题](#aria2-连接问题)
- [评分系统问题](#评分系统问题)
- [下载任务问题](#下载任务问题)
- [性能问题](#性能问题)
- [其他问题](#其他问题)

---

## Aria2 连接问题

### ❌ 错误: "连接失败 - ERR_CONNECTION_REFUSED"

**症状**: 点击"测试连接"后显示"连接失败"

**可能原因**:
1. Aria2 服务未启动
2. RPC 端口错误
3. 防火墙阻止连接

**解决步骤**:

#### 1. 检查 Aria2 是否运行

**Windows**:
```powershell
tasklist | findstr aria2
```

**macOS/Linux**:
```bash
ps aux | grep aria2
```

如果没有输出，说明 Aria2 未运行。启动 Aria2:
```bash
aria2c --enable-rpc --rpc-listen-port=6800
```

#### 2. 检查端口是否正确

默认端口是 `6800`。如果您修改了端口，请确保配置一致。

测试端口是否开放:
```bash
# Windows (PowerShell)
Test-NetConnection -ComputerName localhost -Port 6800

# macOS/Linux
nc -zv localhost 6800
```

#### 3. 检查防火墙

**Windows Defender**:
1. 打开 Windows Defender 防火墙
2. 点击"允许应用通过防火墙"
3. 找到 `aria2c.exe` 并允许

**macOS**:
```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/aria2c
```

**Linux (ufw)**:
```bash
sudo ufw allow 6800/tcp
```

---

### ❌ 错误: "未授权 - Unauthorized"

**症状**: 测试连接显示"未授权"或"Unauthorized"

**原因**: RPC 密钥不匹配

**解决步骤**:

1. **检查 Aria2 配置文件** (`aria2.conf`):
   ```ini
   rpc-secret=YOUR_SECRET_HERE
   ```

2. **在 Starye 中输入相同的密钥**:
   - 个人中心 → Aria2 设置
   - 密钥字段输入 `YOUR_SECRET_HERE`
   - 点击"保存配置"

3. **如果忘记密钥**:
   ```bash
   # 停止 Aria2
   killall aria2c
   
   # 不使用密钥启动（仅本地测试）
   aria2c --enable-rpc --rpc-listen-port=6800
   
   # 在 Starye 中清空密钥字段
   ```

---

### ❌ 错误: "CORS 错误"

**症状**: 浏览器控制台显示 CORS 相关错误

**原因**: 浏览器安全策略阻止跨域请求

**解决方案**: 启用"使用代理"选项

1. 个人中心 → Aria2 设置
2. 勾选 **"使用代理"**
3. 保存配置

**说明**: 启用后，所有请求会通过后端代理，避免 CORS 问题。

---

### ❌ 错误: "网络超时 - ETIMEDOUT"

**症状**: 连接超时，长时间无响应

**可能原因**:
1. Aria2 服务假死
2. 网络延迟过高
3. RPC URL 错误

**解决步骤**:

1. **重启 Aria2**:
   ```bash
   # 停止
   killall aria2c
   
   # 启动
   aria2c --enable-rpc --rpc-listen-port=6800
   ```

2. **检查 RPC URL**:
   - 正确格式: `http://localhost:6800/jsonrpc`
   - 常见错误: 
     - ❌ `http://localhost:6800` (缺少 `/jsonrpc`)
     - ❌ `https://localhost:6800/jsonrpc` (应该用 http)

3. **ping 测试**:
   ```bash
   ping localhost
   ```

---

### ❌ 错误: "远程连接失败"

**症状**: 从其他设备连接 Aria2 失败

**解决步骤**:

1. **修改 Aria2 配置** (`aria2.conf`):
   ```ini
   rpc-listen-all=true
   rpc-secret=YOUR_STRONG_SECRET  # 务必设置！
   ```

2. **获取本机 IP**:
   ```bash
   # Windows
   ipconfig
   
   # macOS/Linux
   ifconfig
   ```

3. **在 Starye 中配置**:
   - RPC URL: `http://YOUR_IP:6800/jsonrpc`
   - 密钥: YOUR_STRONG_SECRET

4. **测试连接**:
   ```bash
   curl http://YOUR_IP:6800/jsonrpc -d '{
     "jsonrpc":"2.0",
     "method":"aria2.getVersion",
     "id":"1"
   }'
   ```

⚠️ **安全警告**: 开放远程访问务必设置强密钥！

---

## 评分系统问题

### ❌ 错误: "请先登录"

**症状**: 点击评分按钮后提示"请先登录"

**原因**: 用户未登录

**解决**: 点击右上角"登录"按钮进行登录

---

### ❌ 错误: "评分过于频繁"

**症状**: 短时间内多次评分后出现此提示

**原因**: 触发频率限制（每分钟最多 10 次）

**解决**: 等待 60 秒后再试

**说明**: 此限制是为了防止刷分行为

---

### ❌ 错误: "评分提交失败"

**症状**: 点击提交后显示失败

**可能原因**:
1. 网络问题
2. 服务器错误
3. 播放源不存在

**解决步骤**:

1. **检查网络连接**:
   - 打开浏览器开发者工具（F12）
   - 查看 Network 选项卡
   - 查找红色的失败请求

2. **重试**:
   - 刷新页面
   - 重新提交评分

3. **清除缓存**:
   ```
   Ctrl + Shift + Delete（Windows）
   Cmd + Shift + Delete（macOS）
   ```

4. **如果持续失败**:
   - 检查浏览器控制台错误
   - 联系管理员

---

### ❓ 为什么我的评分没有立即显示？

**可能原因**:
1. 浏览器缓存
2. 页面未刷新

**解决**:
1. 按 `F5` 或 `Ctrl+R` 刷新页面
2. 硬刷新: `Ctrl+Shift+R`（Windows）或 `Cmd+Shift+R`（macOS）

**说明**: 评分应该立即生效。如果刷新后仍未显示，可能是服务器问题。

---

## 下载任务问题

### ❌ 错误: "添加任务失败"

**症状**: 点击下载按钮后显示"添加任务失败"

**可能原因**:
1. Aria2 未配置或未连接
2. 磁力链接格式错误
3. Aria2 达到并发限制

**解决步骤**:

1. **检查 Aria2 连接**:
   - 个人中心 → Aria2 设置
   - 点击"测试连接"
   - 确保显示"✓ 已连接"

2. **检查磁力链接**:
   - 有效格式: `magnet:?xt=urn:btih:...`
   - 如果链接异常，可能是源数据问题

3. **检查并发限制**:
   在 `aria2.conf` 中调整:
   ```ini
   max-concurrent-downloads=5  # 增加到 10
   ```

---

### ❌ 错误: "任务显示但不下载"

**症状**: 任务已添加到列表，但下载速度为 0

**可能原因**:
1. 磁力链接无种子
2. DHT 未启用
3. 网络问题

**解决步骤**:

1. **启用 DHT**（`aria2.conf`）:
   ```ini
   enable-dht=true
   enable-peer-exchange=true
   bt-enable-lpd=true
   ```

2. **添加 Tracker**:
   ```ini
   bt-tracker=udp://tracker.opentrackr.org:1337/announce,udp://open.demonii.com:1337/announce
   ```

3. **检查日志**:
   ```bash
   aria2c --log=aria2.log --log-level=info
   tail -f aria2.log
   ```

4. **尝试其他播放源**:
   - 同一电影可能有多个播放源
   - 选择评分更高的播放源

---

### ❌ 错误: "下载速度很慢"

**症状**: 下载速度远低于正常网速

**优化建议**:

1. **增加连接数**（`aria2.conf`）:
   ```ini
   max-connection-per-server=16
   split=16
   ```

2. **调整带宽限制**:
   ```ini
   max-overall-download-limit=0  # 不限速
   max-overall-upload-limit=1M   # 限制上传为 1 MB/s
   ```

3. **增加内存缓冲**:
   ```ini
   disk-cache=64M
   file-allocation=falloc
   ```

4. **检查网络**:
   - 测试网速: https://www.speedtest.net/
   - 检查其他设备是否占用带宽

---

### ❓ 任务一直显示"等待中"

**原因**: 超过并发下载限制

**解决**:
- 等待其他任务完成
- 或增加并发限制:
  ```ini
  max-concurrent-downloads=10
  ```

---

### ❓ 无法暂停/恢复任务

**可能原因**:
1. Aria2 连接中断
2. 任务 GID 无效

**解决**:
1. 检查 Aria2 连接状态
2. 刷新页面重新获取任务列表
3. 如果问题持续，重启 Aria2

---

## 性能问题

### ⚠️ 页面加载慢

**症状**: 电影详情页打开缓慢

**可能原因**:
1. 播放源数量过多
2. 网络延迟
3. 浏览器缓存问题

**优化建议**:

1. **清除浏览器缓存**:
   - Chrome: `chrome://settings/clearBrowserData`
   - Firefox: `about:preferences#privacy`

2. **禁用浏览器扩展**:
   - 临时禁用广告拦截器
   - 禁用不必要的扩展

3. **使用更快的网络**:
   - 切换到 Wi-Fi
   - 检查网络延迟

---

### ⚠️ 评分列表加载慢

**症状**: 个人中心的评分历史加载缓慢

**原因**: 评分记录过多

**解决**:
- 使用分页功能
- 每页显示 20 条（默认）
- 避免一次加载所有记录

---

### ⚠️ Aria2 任务列表更新延迟

**症状**: 任务进度更新不及时

**说明**: 
- 使用 WebSocket: 实时更新
- WebSocket 失败后: 每 5 秒轮询一次

**优化**:
1. 确保 Aria2 版本 >= 1.18.4（支持 WebSocket）
2. 检查网络稳定性

---

## 其他问题

### ❓ 浏览器兼容性

**支持的浏览器**:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Safari 14+
- ❌ IE 11（不支持）

**如果页面显示异常**:
1. 更新浏览器到最新版本
2. 清除缓存和 Cookie
3. 尝试无痕模式

---

### ❓ 移动端问题

**症状**: 移动端功能受限

**说明**: 
- Aria2 集成主要为桌面端设计
- 移动端支持基础功能（评分、查看）
- 不建议在移动端配置 Aria2

**建议**: 在电脑上配置 Aria2，手机上浏览和评分

---

### ❓ 隐私和安全

**Q: Aria2 密钥会被泄露吗？**

A: 不会。密钥在服务端加密存储，传输过程使用 HTTPS。

**Q: 评分是匿名的吗？**

A: 不是。评分会关联到您的账号，但其他用户看不到具体是谁评的分。

**Q: 下载记录会被追踪吗？**

A: Starye 不记录您的下载内容，只记录任务的基本信息（GID、添加时间等）。

---

### ❓ 数据同步

**Q: 多设备间如何同步配置？**

A: Aria2 配置和评分记录会自动同步到所有登录设备。

**Q: 如何导出我的评分数据？**

A: 暂不支持导出，此功能规划中。

---

### ❓ 功能请求

如果您有功能建议:
1. 访问 GitHub Issues
2. 创建新 Issue
3. 选择 "Feature Request" 模板
4. 描述您的需求

---

## 诊断工具

### 浏览器开发者工具

1. 打开开发者工具:
   - Windows/Linux: `F12` 或 `Ctrl+Shift+I`
   - macOS: `Cmd+Option+I`

2. 查看 Console:
   - 查找红色错误消息
   - 复制错误信息报告问题

3. 查看 Network:
   - 查看失败的请求
   - 检查响应状态码和内容

### Aria2 日志

启用详细日志:
```bash
aria2c --enable-rpc --log=aria2.log --log-level=debug
```

查看日志:
```bash
# 实时查看
tail -f aria2.log

# 搜索错误
grep -i error aria2.log
```

### 测试 RPC 连接

使用 `curl` 测试:
```bash
curl http://localhost:6800/jsonrpc -H "Content-Type: application/json" -d '{
  "jsonrpc":"2.0",
  "method":"aria2.getVersion",
  "id":"test"
}'
```

预期响应:
```json
{
  "jsonrpc":"2.0",
  "id":"test",
  "result":{"version":"1.37.0"}
}
```

---

## 报告问题

如果以上方法都无法解决问题，请报告:

### 需要提供的信息

1. **问题描述**:
   - 具体症状
   - 重现步骤
   - 预期结果 vs 实际结果

2. **环境信息**:
   - 操作系统
   - 浏览器版本
   - Aria2 版本（如相关）

3. **错误信息**:
   - 浏览器控制台错误
   - Aria2 日志（如相关）
   - 截图或录屏

4. **已尝试的解决方案**:
   - 列出您尝试过的步骤

### 提交渠道

- 📧 Email: support@starye.com
- 🐙 GitHub: https://github.com/starye/starye/issues
- 💬 Discord: https://discord.gg/starye

---

## 快速检查清单

遇到问题时，先检查:

**Aria2 相关**:
- [ ] Aria2 是否正在运行？
- [ ] RPC URL 格式是否正确？
- [ ] 是否启用"使用代理"？
- [ ] 防火墙是否允许连接？

**评分相关**:
- [ ] 是否已登录？
- [ ] 网络连接是否正常？
- [ ] 是否触发频率限制？

**下载相关**:
- [ ] Aria2 是否已连接？
- [ ] 磁力链接是否有效？
- [ ] 是否达到并发限制？

**性能相关**:
- [ ] 浏览器缓存是否过多？
- [ ] 网络延迟是否正常？
- [ ] 浏览器版本是否最新？

---

**如果所有方法都无效，不要犹豫，联系我们获取帮助！** 🤝
