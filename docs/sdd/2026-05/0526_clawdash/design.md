# DESIGN — ClawDash: OpenClaw 增强控制台

> 本方案基于 spec.md 推导而来。spec.md 是唯一事实来源。

## 任务信息
- 任务名: ClawDash (OpenClaw 增强控制台)
- 启动日期: 2026-05-26
- 关联 spec: spec.md
- 关联项目: /opt/data/console/
- GitHub: https://github.com/Kkwans/hermes-console
- 状态: 规划中

## 架构设计

```
┌─────────────────────────────────────────────────┐
│                   浏览器 (PC/移动端)               │
│  ┌─────────────────────────────────────────────┐ │
│  │         ClawDash Vue 3 SPA                  │ │
│  │  (仪表盘|技能|模型|任务|会话|渠道|设置|日志|监控) │ │
│  └──────────────────┬──────────────────────────┘ │
└─────────────────────┼───────────────────────────┘
                      │ HTTP (同源请求)
┌─────────────────────┼───────────────────────────┐
│  Python HTTP Server │:6666                       │
│  ┌──────────────────┴──────────────────────────┐ │
│  │          API Router (/api/*)                │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │ 静态文件  │  │ 配置读写  │  │ Gateway  │  │ │
│  │  │ 服务     │  │ (YAML)   │  │ API 代理  │  │ │
│  │  └──────────┘  └──────────┘  └────┬─────┘  │ │
│  └───────────────────────────────────┼─────────┘ │
└──────────────────────────────────────┼──────────┘
                                       │ HTTP + Bearer Token
                               ┌───────┴────────┐
                               │ Hermes Gateway  │
                               │ Internal API    │
                               │ :18643          │
                               └────────────────┘
```

### 端口策略
- ClawDash 运行在端口 6666（与 OpenClaw 内置控制台共用）
- 通过 Nginx/反向代理或 OpenClaw 配置实现端口复用
- 备选方案：如果无法端口复用，ClawDash 运行在独立端口（如 8088），通过 OpenClaw 配置将默认路由指向 ClawDash

### 反向代理方案
```
:6666 (入口)
  ├── /           → ClawDash (Python serve on :8088)
  ├── /api/clawdash/* → ClawDash API
  ├── /builtin/*  → OpenClaw 内置控制台 (反向代理)
  └── /api/*      → OpenClaw 内置 API (反向代理)
```

## 技术选型

| 层级 | 选型 | 理由 |
|------|------|------|
| 前端框架 | Vue 3 (CDN) | 已有代码基础，轻量 |
| 图表库 | ECharts 5 | 功能丰富，主题自适应 |
| CSS 方案 | 自定义 CSS 变量 | 避免 Tailwind CDN 依赖，更可控 |
| 后端 | Python HTTP Server | 已有代码基础，无额外依赖 |
| 构建工具 | 无（纯静态） | 简化部署，无需 Node.js |
| 代码管理 | Git + GitHub | 版本控制 + 远程备份 |

## 设计系统

### 配色方案 (Vercel 风格)
```css
:root {
  /* 浅色主题 (默认) */
  --bg-primary: #ffffff;
  --bg-secondary: #fafafa;
  --bg-tertiary: #f5f5f5;
  --text-primary: #171717;
  --text-secondary: #666666;
  --text-tertiary: #999999;
  --border: #e5e5e5;
  --border-hover: #d4d4d4;
  --accent: #171717;         /* 主强调色：黑色 */
  --accent-hover: #404040;
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #3b82f6;
}

[data-theme="dark"] {
  --bg-primary: #0a0a0a;
  --bg-secondary: #171717;
  --bg-tertiary: #262626;
  --text-primary: #ededed;
  --text-secondary: #a3a3a3;
  --text-tertiary: #737373;
  --border: #262626;
  --border-hover: #404040;
  --accent: #ededed;
  --accent-hover: #d4d4d4;
}
```

### 禁止使用的颜色
- ❌ 紫色 (#7c3aed, #8b5cf6 等)
- ❌ 蓝紫色 (#6366f1 等)
- ❌ 渐变紫蓝
- ❌ 任何装饰性品牌色

### 排版规范
- 字体：Inter + Noto Sans SC + JetBrains Mono (代码)
- 圆角：8px (卡片)、6px (按钮)、4px (输入框)
- 阴影：极轻 (0 1px 3px rgba(0,0,0,0.05))
- 间距：8px 基准网格

### 组件规范
- 卡片：白色背景、1px 边框、8px 圆角、hover 时边框变深
- 按钮：实心黑色(主)、描边(次)、幽灵(三级)
- 表单：1px 边框输入框、focus 时黑色边框
- 弹窗：居中、遮罩层、ESC 关闭
- Toast：右上角、3 秒自动消失

## API 设计

### 现有 API（保留并增强）
| 端点 | 方法 | 说明 |
|------|------|------|
| /api/config | GET/POST | 读取/保存配置 |
| /api/sessions | GET | 会话列表 |
| /api/sessions/:id/messages | GET | 会话详情 |
| /api/sessions/:id | PUT/DELETE | 编辑/删除会话 |
| /api/cron | GET/POST | 定时任务列表/创建 |
| /api/cron/:id/toggle | POST | 暂停/恢复任务 |
| /api/cron/:id/run | POST | 立即执行 |
| /api/cron/:id | DELETE | 删除任务 |
| /api/skills | GET | 技能列表 |
| /api/plugins | GET | 插件列表 |
| /api/system | GET | 系统信息 |
| /api/logs | GET | 日志 |
| /api/gateway/status | GET | Gateway 状态 |
| /api/gateway/restart | POST | 重启 Gateway |
| /api/model/switch | POST | 切换模型 |

### 新增 API
| 端点 | 方法 | 说明 |
|------|------|------|
| /api/skills/:name | GET | Skill 详情 |
| /api/skills/:name/enable | POST | 启用 Skill |
| /api/skills/:name/disable | POST | 禁用 Skill |
| /api/skills/:name/delete | DELETE | 删除 Skill |
| /api/skills/:name/optimize | POST | AI 优化 Skill |
| /api/skills/batch | POST | 批量操作 |
| /api/skills/dirs | GET/POST | Skill 目录配置 |
| /api/models | GET | 模型列表 |
| /api/models/providers | GET/POST/PUT/DELETE | 提供商 CRUD |
| /api/models/:id | PUT/DELETE | 模型编辑/删除 |
| /api/models/default | POST | 设置默认模型 |
| /api/models/fallback | POST | 设置兜底模型 |
| /api/channels | GET | 渠道列表 |
| /api/channels/:name/enable | POST | 启用渠道 |
| /api/channels/:name/disable | POST | 禁用渠道 |
| /api/cron/:id/history | GET | 任务执行历史 |
| /api/monitor/cpu | GET | CPU 使用率 |
| /api/monitor/memory | GET | 内存使用率 |
| /api/monitor/history | GET | 历史监控数据 |

## 页面布局设计

### 仪表盘布局
```
┌─────────────────────────────────────────────┐
│  顶栏：页面标题 | [主题切换] [官方控制台] [刷新] │
├─────────┬───────────────────────────────────┤
│         │  ┌─────────┐ ┌─────────┐ ┌──────┐ │
│         │  │ 运行状态 │ │ CPU     │ │ 内存  │ │
│  侧边栏  │  └─────────┘ └─────────┘ └──────┘ │
│         │  ┌─────────────────────────────────┐│
│  仪表盘  │  │     CPU/内存趋势图 (ECharts)    ││
│  技能    │  └─────────────────────────────────┘│
│  模型    │  ┌──────────┐ ┌───────────────────┐│
│  任务    │  │ 已配置模型 │ │   连接渠道        ││
│  会话    │  └──────────┘ └───────────────────┘│
│  渠道    │  ┌─────────────────────────────────┐│
│  插件    │  │         最近日志                 ││
│  设置    │  └─────────────────────────────────┘│
│  日志    │                                     │
│  监控    │                                     │
│         │  ┌─ 网关状态 ─┐    ┌─ 启停按钮 ─┐   │
│         │  └────────────┘    └────────────┘   │
├─────────┴───────────────────────────────────┤
│  底栏：网关状态 + 启停按钮                      │
└─────────────────────────────────────────────┘
```

### 移动端布局
```
┌─────────────────────┐
│ ☰  ClawDash    🌐  │  ← 顶部栏
├─────────────────────┤
│  运行状态            │
│  ┌────────┐ ┌─────┐ │
│  │ CPU    │ │ 内存 │ │
│  └────────┘ └─────┘ │
│  趋势图              │
│  ┌─────────────────┐ │
│  │  ECharts 图表   │ │
│  └─────────────────┘ │
│  模型 | 渠道         │
│  日志                │
│  ────────────────    │
│  网关状态  [启停]    │
└─────────────────────┘
```

## 目录结构

```
/opt/data/console/
├── index.html          # SPA 入口
├── css/
│   └── main.css        # 样式（CSS 变量体系）
├── js/
│   ├── app.js          # Vue 主应用
│   ├── api.js          # API 通信层
│   └── utils.js        # 工具函数
├── serve.py            # Python 后端
├── docs/
│   └── sdd/            # SDD 文档
└── .git/               # Git 仓库
```

## 阶段规划

| 阶段 | 内容 | 对应 spec 需求 | 预计轮次 |
|------|------|---------------|----------|
| Phase 1 | 基础框架重构 + 设计系统 | F1 仪表盘基础 | 3-4 轮 |
| Phase 2 | 仪表盘完善 + 监控 | F1 完整 + F10 | 2-3 轮 |
| Phase 3 | 技能管理 | F2 | 3-4 轮 |
| Phase 4 | 模型管理 | F3 | 2-3 轮 |
| Phase 5 | 定时任务 | F4 | 2 轮 |
| Phase 6 | 会话管理 | F5 | 2 轮 |
| Phase 7 | 消息渠道 + 插件 | F6 + F7 | 2 轮 |
| Phase 8 | 系统设置 + 日志 | F8 + F9 | 2 轮 |
| Phase 9 | 端口复用 + 反向代理 | 架构 | 1-2 轮 |
| Phase 10 | 最终验收 + 收尾 | AC1-AC29 | 1 轮 |

## 风险与依赖

- **端口复用**：需要研究 OpenClaw 的端口配置方式，可能需要 Nginx 反向代理
- **Gateway API 限制**：部分功能可能需要直接读取文件系统
- **Skill AI 优化**：需要调用 LLM API，依赖 Gateway 的模型配置
- **代码量大**：前端代码预计 3000-5000 行，需要分阶段实现
