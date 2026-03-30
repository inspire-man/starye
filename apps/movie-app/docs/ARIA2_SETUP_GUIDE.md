# Aria2 配置指南

> 完整的 Aria2 下载工具集成配置教程

---

## 📖 目录

- [什么是 Aria2](#什么是-aria2)
- [快速开始](#快速开始)
- [详细配置](#详细配置)
- [常见问题](#常见问题)
- [高级功能](#高级功能)

---

## 什么是 Aria2

Aria2 是一个轻量级、多协议、多源的命令行下载工具，支持：

- ✅ HTTP/HTTPS 下载
- ✅ FTP/SFTP 下载
- ✅ **BitTorrent（磁力链接）**
- ✅ Metalink 下载
- ✅ 多线程并发下载
- ✅ 断点续传

通过 Starye 集成 Aria2，您可以：
1. 🎯 直接从电影详情页添加磁力链接到 Aria2
2. 📊 实时查看下载进度和速度
3. ⚡ 批量管理下载任务
4. 💾 自动同步下载列表

---

## 快速开始

### 步骤 1: 安装

#### Windows

**方式 1: 使用 Scoop（推荐）**
```powershell
# 安装 Scoop（如果未安装）
irm get.scoop.sh | iex

# 安装 Aria2
scoop install aria2
```

**方式 2: 手动下载**
1. 访问 [Aria2 GitHub Releases](https://github.com/aria2/aria2/releases)
2. 下载 `aria2-*-win-64bit-build1.zip`
3. 解压到 `C:\Program Files\aria2\`
4. 将 `C:\Program Files\aria2\` 添加到系统 PATH

#### macOS

```bash
# 使用 Homebrew
brew install aria2
```

#### Linux

```bash
# Ubuntu/Debian
sudo apt install aria2

# CentOS/RHEL
sudo yum install aria2

# Arch Linux
sudo pacman -S aria2
```

### 步骤 2: 启动 Aria2 RPC 服务

#### 基础启动（推荐新手）

```bash
# Windows (PowerShell)
aria2c --enable-rpc --rpc-listen-all=false --rpc-listen-port=6800

# macOS/Linux
aria2c --enable-rpc --rpc-listen-all=false --rpc-listen-port=6800
```

#### 后台运行（推荐）

**Windows**:
```powershell
# 创建启动脚本 start-aria2.bat
@echo off
start /B aria2c --enable-rpc --rpc-listen-all=false --rpc-listen-port=6800 --dir=D:\Downloads
```

**macOS/Linux**:
```bash
# 后台启动
aria2c --enable-rpc --daemon=true --rpc-listen-port=6800 --dir=~/Downloads

# 或使用 systemd（推荐）
sudo systemctl enable aria2
sudo systemctl start aria2
```

### 步骤 3: 在 Starye 中配置

1. 登录 Starye
2. 访问 **个人中心** → **Aria2 设置**
3. 填写配置信息：
   - **RPC URL**: `http://localhost:6800/jsonrpc`
   - **密钥**: 留空（如未设置）
   - **使用代理**: 启用（推荐）
4. 点击 **测试连接**
5. 显示 "✓ 已连接" 后，点击 **保存配置**

### 步骤 4: 开始下载

1. 浏览电影，进入详情页
2. 找到播放源卡片
3. 点击 **下载** 按钮
4. 任务自动添加到 Aria2
5. 在 **个人中心** → **下载管理** 查看进度

🎉 **完成！现在您可以使用 Aria2 下载了！**

---

## 详细配置

### Aria2 配置文件

创建配置文件以保存设置（推荐）：

#### Windows

创建 `C:\Users\YourName\.aria2\aria2.conf`:

```ini
# RPC 设置
enable-rpc=true
rpc-listen-all=false
rpc-listen-port=6800
# rpc-secret=YOUR_SECRET_TOKEN

# 下载设置
dir=D:\Downloads\Aria2
max-concurrent-downloads=5
max-connection-per-server=16
min-split-size=10M
split=16

# 进度保存
input-file=D:\Downloads\Aria2\aria2.session
save-session=D:\Downloads\Aria2\aria2.session
save-session-interval=60

# BT 设置
bt-max-peers=50
bt-tracker-connect-timeout=60
bt-tracker-timeout=60
enable-dht=true
enable-peer-exchange=true
seed-ratio=1.0

# 其他设置
continue=true
max-overall-download-limit=0
max-overall-upload-limit=1M
```

#### macOS/Linux

创建 `~/.aria2/aria2.conf`:

```ini
# RPC 设置
enable-rpc=true
rpc-listen-all=false
rpc-listen-port=6800
# rpc-secret=YOUR_SECRET_TOKEN

# 下载设置
dir=/Users/yourname/Downloads/Aria2
max-concurrent-downloads=5
max-connection-per-server=16
min-split-size=10M
split=16

# 进度保存
input-file=/Users/yourname/Downloads/Aria2/aria2.session
save-session=/Users/yourname/Downloads/Aria2/aria2.session
save-session-interval=60

# BT 设置
bt-max-peers=50
enable-dht=true
enable-peer-exchange=true
seed-ratio=1.0

# 其他设置
continue=true
max-overall-download-limit=0
max-overall-upload-limit=1M
```

使用配置文件启动：

```bash
aria2c --conf-path=/path/to/aria2.conf
```

### 设置 RPC 密钥（推荐）

#### 1. 生成密钥

```bash
# 生成随机密钥
openssl rand -base64 32
# 或
uuidgen
```

#### 2. 在 aria2.conf 中添加

```ini
rpc-secret=YOUR_GENERATED_SECRET
```

#### 3. 在 Starye 中配置

- **密钥**: 填入上面生成的密钥
- 保存并测试连接

### 自动启动 Aria2

#### Windows（任务计划程序）

1. 打开 **任务计划程序**
2. 创建基本任务：
   - 名称: `Aria2 RPC Server`
   - 触发器: **用户登录时**
   - 操作: **启动程序**
   - 程序: `aria2c`
   - 参数: `--conf-path=C:\Users\YourName\.aria2\aria2.conf`

#### macOS（launchd）

创建 `~/Library/LaunchAgents/aria2.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>aria2</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/aria2c</string>
        <string>--conf-path=/Users/yourname/.aria2/aria2.conf</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

加载服务：

```bash
launchctl load ~/Library/LaunchAgents/aria2.plist
```

#### Linux（systemd）

创建 `/etc/systemd/system/aria2.service`:

```ini
[Unit]
Description=Aria2 RPC Server
After=network.target

[Service]
Type=forking
User=yourname
ExecStart=/usr/bin/aria2c --conf-path=/home/yourname/.aria2/aria2.conf
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

启用并启动：

```bash
sudo systemctl enable aria2
sudo systemctl start aria2
sudo systemctl status aria2
```

---

## 常见问题

### ❓ 连接失败：ERR_CONNECTION_REFUSED

**原因**: Aria2 RPC 服务未启动

**解决**:
1. 检查 Aria2 是否正在运行：
   ```bash
   # Windows
   tasklist | findstr aria2

   # macOS/Linux
   ps aux | grep aria2
   ```
2. 如果未运行，启动 Aria2:
   ```bash
   aria2c --enable-rpc --rpc-listen-port=6800
   ```

### ❓ 连接失败：Unauthorized

**原因**: RPC 密钥不匹配

**解决**:
1. 检查 Aria2 配置文件中的 `rpc-secret`
2. 在 Starye 的 Aria2 设置中填入相同的密钥
3. 重新测试连接

### ❓ 下载速度慢

**优化建议**:

1. **增加连接数**（aria2.conf）:
   ```ini
   max-connection-per-server=16
   split=16
   ```

2. **添加 BT Tracker**:
   ```bash
   # 自动更新 Tracker 列表
   bt-tracker=http://tracker.example.com/announce
   ```

3. **调整带宽限制**:
   ```ini
   max-overall-download-limit=0  # 不限速
   ```

### ❓ 磁力链接无法下载

**可能原因**:
1. DHT 未启用
2. 缺少 Tracker 服务器

**解决**:
```ini
# aria2.conf
enable-dht=true
enable-peer-exchange=true
bt-enable-lpd=true
bt-tracker=udp://tracker.opentrackr.org:1337/announce,udp://open.demonii.com:1337/announce
```

### ❓ 任务显示但不下载

**检查步骤**:
1. 查看 Aria2 日志:
   ```bash
   aria2c --log=aria2.log --log-level=info
   ```
2. 检查磁力链接是否有效
3. 确认下载目录有写入权限

### ❓ WebSocket 连接失败

**说明**: Starye 会自动降级到轮询模式

**优化**（可选）:
1. 确保 Aria2 支持 WebSocket（版本 >= 1.18.4）
2. 在防火墙中允许 WebSocket 连接

---

## 高级功能

### 远程访问 Aria2

如果需要从其他设备访问 Aria2：

#### 1. 修改配置

```ini
# aria2.conf
rpc-listen-all=true  # 允许外部访问
rpc-secret=YOUR_SECRET  # 务必设置密钥！
```

#### 2. 配置防火墙

```bash
# Linux (ufw)
sudo ufw allow 6800/tcp

# Windows
# 在 Windows Defender 防火墙中添加入站规则
```

#### 3. 在 Starye 中配置

- **RPC URL**: `http://YOUR_IP:6800/jsonrpc`
- **密钥**: YOUR_SECRET
- **使用代理**: 启用（推荐）

⚠️ **安全提示**: 远程访问务必设置强密钥，避免未授权访问！

### 使用 Aria2 Web UI

推荐的 Web UI 工具：

1. **AriaNg** - https://github.com/mayswind/AriaNg
2. **Aria2 WebUI** - https://github.com/ziahamza/webui-aria2

配置方式：
- 下载并解压到 Web 服务器
- 访问 Web UI
- 设置 RPC URL: `http://localhost:6800/jsonrpc`

### 批量导入磁力链接

从文件批量添加：

1. 创建 `magnets.txt`，每行一个磁力链接
2. 使用 Aria2 导入:
   ```bash
   aria2c --input-file=magnets.txt
   ```

或在 Starye 中：
1. 打开电影列表
2. 点击 **批量下载**
3. 选择多个播放源
4. 一键添加到 Aria2

### 性能调优

针对不同网络环境的优化建议：

#### 家庭宽带（100-500 Mbps）

```ini
max-concurrent-downloads=5
max-connection-per-server=10
split=10
min-split-size=10M
```

#### 千兆网络（1000+ Mbps）

```ini
max-concurrent-downloads=10
max-connection-per-server=16
split=16
min-split-size=5M
```

#### 移动网络 / 受限网络

```ini
max-concurrent-downloads=3
max-connection-per-server=8
split=8
min-split-size=20M
max-overall-download-limit=5M  # 5 MB/s 限速
```

---

## 故障排查

### 日志查看

启用详细日志：

```bash
aria2c --enable-rpc --log=aria2.log --log-level=debug
```

查看日志：

```bash
# Windows
type aria2.log | findstr ERROR

# macOS/Linux
tail -f aria2.log | grep ERROR
```

### 常用命令

```bash
# 查看 Aria2 版本
aria2c --version

# 测试 RPC 连接（使用 curl）
curl http://localhost:6800/jsonrpc -d '{
  "jsonrpc":"2.0",
  "method":"aria2.getVersion",
  "id":"1"
}'

# 查看活跃任务
curl http://localhost:6800/jsonrpc -d '{
  "jsonrpc":"2.0",
  "method":"aria2.tellActive",
  "id":"1"
}'
```

### 重置配置

如果遇到配置问题，可以重置：

1. 停止 Aria2
2. 删除配置文件（备份后）:
   - Windows: `C:\Users\YourName\.aria2\`
   - macOS/Linux: `~/.aria2/`
3. 重新按照快速开始配置

---

## 资源链接

- 📘 [Aria2 官方文档](https://aria2.github.io/)
- 🐙 [Aria2 GitHub](https://github.com/aria2/aria2)
- 💬 [Aria2 中文社区](https://aria2c.com/)
- 🎨 [AriaNg Web UI](https://github.com/mayswind/AriaNg)

---

## 需要帮助？

如果遇到问题：

1. 查看本文档的 [常见问题](#常见问题) 部分
2. 检查 Aria2 日志文件
3. 访问 [故障排查文档](./TROUBLESHOOTING.md)
4. 在 GitHub 提交 Issue

---

**祝您下载愉快！** 🎉
