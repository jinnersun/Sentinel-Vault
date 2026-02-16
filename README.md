# DevVault

开发者凭证与资产管理器 - 一站式管理 API Keys、服务器、数据库和项目凭证

## 功能特性

### 核心功能
- 🔑 **API Keys 管理** - 安全存储和管理各类 API 密钥
- 🖥️ **基础设施资产** - 管理服务器和数据库连接信息
- 📁 **项目中心** - 项目看板展示架构、README、关联资源
- 🔒 **安全存储** - AES-256-GCM 加密，本地存储不上传
- 📥 **Chrome 导入** - 支持从 Chrome 密码管理器导入凭证
- 🔍 **智能搜索** - 快速查找凭证和资产

### UI/UX
- 🎨 深色主题设计
- 📱 响应式三栏布局
- ⚡ 快捷键支持 (Ctrl+K 搜索)
- 🎯 一键复制 SSH 命令、数据库连接串
- 👁️ 密码脱敏显示

### 安全性
- 🔐 AES-256-GCM 加密存储
- 🔑 Argon2 密码哈希
- 🔒 隐身模式保护
- 🛡️ 本地存储，数据不上云

## 快速开始

### 环境要求
- Node.js 18+
- Rust 1.70+

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run tauri dev
```

### 构建发布
```bash
npm run tauri build
```

## 项目结构

```
devvault/
├── src/                     # 前端代码 (React + TypeScript)
│   ├── components/         # React 组件
│   │   ├── ProjectDashboard.tsx    # 项目看板
│   │   ├── ProjectRelations.tsx    # 项目资源管理器
│   │   ├── InfrastructureView.tsx  # 基础设施资产
│   │   └── ...
│   ├── contexts/           # React Context
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具函数
│   └── types/              # TypeScript 类型
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── commands.rs     # Tauri 命令
│   │   ├── database.rs     # 数据库操作
│   │   └── crypto.rs       # 加密功能
│   └── migrations/         # 数据库迁移文件
└── docs/                   # 开发文档 (已加入 .gitignore)
```

## 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS + Vite
- **后端**: Rust + Tauri 2.0
- **数据库**: SQLite (sqlx)
- **UI 图标**: Lucide React
- **加密**: ring crate (AES-256-GCM)

## 最近更新

### v2.0 - 基础设施资产管理
- ✨ 新增服务器和数据库资产管理
- ✨ 项目看板支持展示架构、README
- ✨ 项目资源管理器分类展示 Servers/Databases/API Keys
- ✨ 未保存更改提示机制
- ✨ Chrome 密码导入功能

## 许可证

MIT License