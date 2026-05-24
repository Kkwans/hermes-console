# 🚀 Hermes Console

为 [Hermes Agent](https://github.com/NousResearch/hermes-agent) 打造的中文友好 Web 控制台。

## ✨ 特性

- 🇨🇳 **全中文界面** — 所有文字、提示、说明均为中文
- 🌓 **双主题** — 默认浅色主题，支持切换到深色主题，偏好自动保存
- 📱 **移动端适配** — 响应式布局，手机上完美显示
- 🏗️ **零构建** — 纯前端 SPA，CDN 引入 Vue 3 + ECharts + Tailwind CSS
- 🎯 **小白易用** — 简化操作流程，突出常用功能

## 📋 功能模块

| 模块 | 说明 |
|------|------|
| 🏠 仪表盘 | 系统状态概览、CPU/内存图表、日志预览 |
| 💬 会话管理 | 查看、搜索、删除活跃会话 |
| ⏰ 定时任务 | 管理 Cron 任务，支持启停和立即执行 |
| 🧩 技能管理 | 浏览和搜索已安装技能 |
| 🤖 模型配置 | 查看当前模型和已配置提供商 |
| 📡 消息渠道 | 查看 Gateway 连接的渠道状态 |
| ⚙️ 系统设置 | 修改智能体和显示设置 |
| 📝 日志查看 | 实时日志浏览，支持级别筛选和搜索 |
| 📊 系统监控 | CPU/内存/磁盘使用率实时监控 |

## 🛠️ 安装部署

### 前提条件

- Python 3.8+
- Hermes Agent 已安装并运行

### 启动方式

```bash
# 方式一：直接启动
cd /opt/data/console
python3 serve.py

# 方式二：使用启动脚本
./start.sh 8089

# 方式三：指定端口
CONSOLE_PORT=9090 python3 serve.py
```

启动后访问: `http://<服务器IP>:8089`

### 首次使用

1. 打开控制台地址
2. 输入 Gateway 内部 API Token（在 `config.yaml` 中配置）
3. 点击"连接"即可开始使用

## 🔧 配置说明

### 获取 Gateway Token

在 Hermes 的配置文件中查找 `GATEWAY_INTERNAL_TOKEN`：

```bash
cat /opt/data/config.yaml | grep -i token
```

### 修改端口

```bash
# 环境变量方式
export CONSOLE_PORT=9090
python3 serve.py

# 或直接修改 serve.py 中的 PORT 默认值
```

## 📁 项目结构

```
console/
├── index.html          # 主页面（Vue 3 SPA）
├── css/
│   └── main.css        # 样式（双主题）
├── js/
│   ├── app.js          # Vue 应用主逻辑
│   ├── api.js          # API 通信层
│   └── utils.js        # 工具函数
├── serve.py            # 后端服务器（静态文件 + API 代理）
├── start.sh            # 启动脚本
└── README.md           # 本文件
```

## ❓ 常见问题

**Q: 连接失败怎么办？**
A: 检查 Gateway 是否运行，Token 是否正确，端口是否可达。

**Q: 数据不更新？**
A: 点击右上角刷新按钮，或检查 Gateway 状态。

**Q: 如何切换主题？**
A: 点击顶部栏的 🌙/☀️ 图标即可切换，偏好自动保存。

## 📄 许可证

MIT License
